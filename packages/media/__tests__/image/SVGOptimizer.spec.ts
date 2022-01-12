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

		const { calls } = store.putCache.mock;
		const [identity, gzip, brotli] = calls;
		expect(calls).toHaveLength(3);

		expect(identity[2]).toStrictEqual({});
		expect(gzip[2]).toStrictEqual({ encoding: "gz" });
		expect(brotli[2]).toStrictEqual({ encoding: "br" });

		expect(brotli[1].length).toBeLessThan(gzip[1].length);
		expect(gzip[1].length).toBeLessThan(identity[1].length);
	});
});

describe("getCache", () => {
	it("should return falsy value if not cache found", async () => {
		store.getCache.mockResolvedValue(null);

		const promise = optimizer.getCache({
			name: "test",
			parameters: {},
			codecs: [],
			acceptTypes: [],
			acceptEncodings: [],
		});

		return expect(promise).resolves.toBeFalsy();
	});

	it("should return compressed is possible", async () => {
		store.getCache.mockResolvedValueOnce(null);
		store.getCache.mockResolvedValue({
			data: "data123",
			size: 6,
			mtime: new Date(),
		});

		const result = await optimizer.getCache({
			name: "test",
			parameters: {},
			codecs: [],
			acceptTypes: [],
			acceptEncodings: ["gzip", "deflate", "br"],
		});

		expect(result!.type).toBe("svg");
		expect(result!.encoding).toBe("gzip");

		const { calls } = store.getCache.mock;
		expect(calls).toHaveLength(2);
		expect(calls[0][1]).toStrictEqual({ encoding: "br" });
		expect(calls[1][0]).toBe("test");
		expect(calls[1][1]).toStrictEqual({ encoding: "gz" });
	});

	it("should not return unsupported encoding", async () => {
		store.getCache.mockResolvedValue({
			data: "data123",
			size: 6,
			mtime: new Date(),
		});

		const result = await optimizer.getCache({
			name: "test",
			parameters: {},
			codecs: [],
			acceptTypes: [],
			acceptEncodings: [],
		});

		expect(result!.encoding).toBeUndefined();
		expect(store.getCache.mock.calls).toHaveLength(1);
	});
});
