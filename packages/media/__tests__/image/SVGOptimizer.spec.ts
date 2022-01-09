import SVGOptimizer from "../../lib/image/SVGOptimizer";
import { BadDataError } from "../../lib/errors";
import { readFixture } from "../test-utils";

const small = '<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>';

const store = {
	putCache: jest.fn(),
	getCache: jest.fn(),
	save: jest.fn(),
	load: jest.fn(),
};

const request = {
	buffer: readFixture("digraph.svg"),
	type: "svg",
	parameters: {},
};

const optimizer = new SVGOptimizer(store);

it("should restrict file type", () => {
	const promise = optimizer.check({
		type: "html",
		parameters: {},
		buffer: Buffer.alloc(0),
	});

	return expect(promise).rejects.toThrow(BadDataError);
});

it("should throw on invalid data", () => {
	const promise = optimizer.buildCache("test", {
		...request,
		buffer: Buffer.from("foobar"),
	});
	return expect(promise).rejects.toThrow(BadDataError);
});

it("should not compress with Brotli on small data", async () => {
	await optimizer.buildCache("test", {
		...request,
		buffer: Buffer.from(small),
	});

	expect(store.putCache.mock.calls).toHaveLength(2);

	const [identity, gzip] = store.putCache.mock.calls;
	expect(identity[1].charAt(0)).toBe("<"); // 未压缩
	expect(gzip[2]).toStrictEqual({ encoding: "gz" });
});

it("should optimize the file", async () => {
	await optimizer.buildCache("test", request);

	const [identity, gzip, brotli] = store.putCache.mock.calls;
	expect(store.putCache.mock.calls).toHaveLength(3);
	expect(brotli[2]).toStrictEqual({ encoding: "br" });
});

it("should get falsy value if file not exists", () => {
	store.getCache.mockResolvedValue(null);

	const promise =  optimizer.getCache({
		name: "test",
		parameters: {},
		codecs: [],
		acceptTypes: [],
		acceptEncodings: [],
	});

	return expect(promise).resolves.toBeFalsy();
});
