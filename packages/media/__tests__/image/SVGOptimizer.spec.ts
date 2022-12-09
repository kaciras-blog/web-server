import { describe, expect, it } from "vitest";
import { BadDataError } from "../../lib/errors.js";
import { readFixture } from "../test-utils.js";
import SVGOptimizer from "../../lib/image/SVGOptimizer.js";

const small = '<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>';

const request = {
	buffer: readFixture("digraph.svg"),
	type: "svg",
	parameters: {},
};

const optimizer = new SVGOptimizer();

describe("check", () => {
	it("should restrict file type", () => {
		const promise = optimizer.check({
			type: "html",
			parameters: {},
			buffer: Buffer.alloc(0),
		});

		return expect(promise).rejects.toThrow(BadDataError);
	});
});

describe("buildCache", () => {

	it("should throw on invalid data", () => {
		const promise = optimizer.buildCache({
			...request,
			buffer: Buffer.from("foobar"),
		});
		return expect(promise).rejects.toThrow(BadDataError);
	});

	it("should not compress for small data", async () => {
		const items = await optimizer.buildCache({
			...request,
			buffer: Buffer.from(small),
		});

		expect(items).toHaveLength(1);
		expect((items[0].data as string).charAt(0)).toBe("<");
	});

	it("should optimize the file", async () => {
		const items = await optimizer.buildCache(request);

		expect(items).toHaveLength(3);
		const [brotli, gzip, identity] = items;

		expect(identity.params).toStrictEqual({ type: "svg" });
		expect(gzip.params).toStrictEqual({ type: "svg", encoding: "gzip" });
		expect(brotli.params).toStrictEqual({ type: "svg", encoding: "br" });

		expect(brotli.data.length).toBeLessThan(gzip.data.length);
		expect(gzip.data.length).toBeLessThan(identity.data.length);
	});
});

describe("select", () => {
	it("should return falsy value if no acceptable", () => {
		const item = optimizer.select([], {
			name: "test",
			parameters: {},
			codecs: [],
			acceptTypes: [],
			acceptEncodings: ["gzip", "deflate", "br"],
		});

		return expect(item).toBeFalsy();
	});

	it("should return compressed is possible", () => {
		const item = optimizer.select([
			{ type: "svg", encoding: "gzip" },
			{ type: "svg" },
			{ type: "svg", encoding: "br" },
		], {
			name: "test",
			parameters: {},
			codecs: [],
			acceptTypes: [],
			acceptEncodings: ["gzip", "deflate", "br"],
		});

		expect(item).toStrictEqual({ type: "svg", encoding: "br" });
	});

	it("should not return unsupported encoding", () => {
		const item = optimizer.select([
			{ type: "svg", encoding: "gzip" },
			{ type: "svg" },
			{ type: "svg", encoding: "br" },
		], {
			name: "test",
			parameters: {},
			codecs: [],
			acceptTypes: [],
			acceptEncodings: [],
		});

		expect(item).toStrictEqual({ type: "svg" });
	});
});
