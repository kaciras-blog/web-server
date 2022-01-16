import { readFixture } from "../test-utils";
import RasterOptimizer from "../../lib/image/RasterOptimizer";
import { BadDataError, ProcessorError } from "../../lib/errors";
import { crop } from "../../lib/image/param-processor";
import { FileStore } from "../../lib/FileStore";
import * as encoder from "../../lib/image/encoder";

jest.mock("../../lib/image/param-processor");
jest.mock("../../lib/image/encoder");

const store: jest.MockedObject<FileStore> = {
	save: jest.fn(),
	load: jest.fn(),
	putCache: jest.fn(),
	getCache: jest.fn(),
};

const saveRequest = {
	buffer: readFixture("tile_16x16.png"),
	type: "png",
	parameters: {},
};

const loadRequest = {
	name: "maoG0wFHmNhgAcMkRo1J.png",
	parameters: {},
	codecs: [],
	acceptTypes: ["avif", "webp"],
	acceptEncodings: [],
};

const optimizer = new RasterOptimizer(store);

describe("check", () => {
	test.each(
		["jp2", "html", "", "../.."],
	)("should restrict file type %#", (type) => {
		const promise = optimizer.check({
			type,
			parameters: {},
			buffer: Buffer.alloc(0),
		});

		return expect(promise).rejects.toThrow(BadDataError);
	});

	it("should normalize type", async () => {
		const request = {
			...saveRequest,
			type: "jpeg",
		};
		await optimizer.check(request);
		expect(request.type).toBe("jpg");
	});

	it("should crop the image", async () => {
		const cropped = Buffer.alloc(0);
		const fn = crop as jest.Mock;
		fn.mockReturnValue({
			toBuffer() { return cropped; },
		});
		const request = {
			...saveRequest,
			parameters: { crop: "foobar" },
		};

		await optimizer.check(request);

		expect(request.buffer).toBe(cropped);
		expect(fn.mock.calls[0][1]).toBe("foobar");
	});
});

describe("buildCache", () => {
	const { optimize, encodeWebp, encodeAVIF } = encoder as jest.MockedObject<typeof encoder>;

	it("should optimize the image", async () => {
		optimize.mockResolvedValue(Buffer.alloc(3));
		encodeWebp.mockResolvedValue(Buffer.alloc(2));
		encodeAVIF.mockResolvedValue(Buffer.alloc(1));

		await optimizer.buildCache("foobar.png", saveRequest);

		const { calls } = store.putCache.mock;
		expect(calls).toHaveLength(3);
		expect(calls[0][2]).toStrictEqual({ type: "png" });
		expect(calls[1][2]).toStrictEqual({ type: "webp" });
		expect(calls[2][2]).toStrictEqual({ type: "avif" });
	});

	it("should ignore unprocessable", async () => {
		optimize.mockResolvedValue(Buffer.alloc(1));
		encodeWebp.mockRejectedValue(new ProcessorError());
		encodeAVIF.mockResolvedValue(Buffer.alloc(1));

		await optimizer.buildCache("foobar.png", saveRequest);
		expect(store.putCache.mock.calls).toHaveLength(1);
	});

	it("should save new format only if it smaller than old", async () => {
		optimize.mockResolvedValue(Buffer.alloc(1));
		encodeWebp.mockResolvedValue(Buffer.alloc(1));
		encodeAVIF.mockResolvedValue(Buffer.alloc(1));

		await optimizer.buildCache("foobar.png", saveRequest);

		const { calls } = store.putCache.mock;
		expect(calls).toHaveLength(1);
		expect(calls[0][2]).toStrictEqual({ type: "png" });
	});
});

describe("getCache", () => {
	it("should return new format if possible", async () => {
		store.getCache.mockResolvedValue({
			data: "data123",
			size: 6,
			mtime: new Date(),
		});
		await optimizer.getCache(loadRequest);

		const { calls } = store.getCache.mock;
		expect(calls).toHaveLength(1);
		expect(calls[0][0]).toBe("maoG0wFHmNhgAcMkRo1J");
		expect(calls[0][1]).toStrictEqual({ type: "avif" });
	});

	it("should not return unsupported format", async () => {
		store.getCache.mockResolvedValue({
			data: "data123",
			size: 6,
			mtime: new Date(),
		});

		await optimizer.getCache({
			...loadRequest,
			acceptTypes: ["webp"],
		});

		const { calls } = store.getCache.mock;
		expect(calls[0][1]).toStrictEqual({ type: "webp" });
	});

	it("should fallback to original format", async () => {
		store.getCache.mockResolvedValueOnce(null);
		store.getCache.mockResolvedValueOnce(null);
		store.getCache.mockResolvedValue({
			data: "data123",
			size: 6,
			mtime: new Date(),
		});

		const result = await optimizer.getCache(loadRequest);

		const { calls } = store.getCache.mock;
		expect(result!.type).toBe("png");
		expect(calls).toHaveLength(3);
		expect(calls[2][1]).toStrictEqual({});
	});

	it("should return falsy value if not cache found", () => {
		store.getCache.mockResolvedValue(null);
		return expect(optimizer.getCache(loadRequest)).resolves.toBeFalsy();
	});
});
