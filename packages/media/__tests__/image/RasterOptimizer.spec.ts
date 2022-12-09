import { describe, expect, it, MockedFunction, MockedObject, vi } from "vitest";
import { readFixture } from "../test-utils.js";
import { BadDataError, crop, ProcessorError, resize } from "../../lib/index.js";
import * as encoder from "../../lib/image/encoder.js";
import RasterOptimizer from "../../lib/image/RasterOptimizer.js";

vi.mock("../../lib/image/param-processor", () => ({
	crop: vi.fn(),
	resize: vi.fn(),
}));

vi.mock("../../lib/image/encoder", () => ({
	encodeWebp: vi.fn(),
	encodeAVIF: vi.fn(),
	optimizeRaster: vi.fn(),
}));

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

const optimizer = new RasterOptimizer();

describe("check", () => {
	for (const type of ["jp2", "html", "", "../.."]) {
		it(`should restrict file type ${type}`, () => {
			const promise = optimizer.check({
				type,
				parameters: {},
				buffer: Buffer.alloc(0),
			});

			return expect(promise).rejects.toThrow(BadDataError);
		});
	}

	it("should normalize type", async () => {
		const request = {
			...saveRequest,
			type: "jpeg",
		};
		await optimizer.check(request);
		expect(request.type).toBe("jpg");
	});

	it("should process the image", async () => {
		const cropped = Buffer.alloc(0);
		const fn = crop as MockedFunction<any>;
		fn.mockReturnValue({
			png() { return this; },
			toBuffer() { return cropped; },
		});
		const request = {
			...saveRequest,
			parameters: { crop: "foobar" },
		};

		await optimizer.check(request);

		expect(request.buffer).toBe(cropped);
		expect(fn.mock.calls[0][1]).toBe("foobar");
		expect(resize).not.toHaveBeenCalled();
	});
});

describe("buildCache", () => {
	const { optimizeRaster, encodeWebp, encodeAVIF } = encoder as MockedObject<typeof encoder>;

	it("should optimize the image", async () => {
		optimizeRaster.mockResolvedValue(Buffer.alloc(3));
		encodeWebp.mockResolvedValue(Buffer.alloc(2));
		encodeAVIF.mockResolvedValue(Buffer.alloc(1));

		const items = await optimizer.buildCache(saveRequest);

		expect(items).toHaveLength(3);
		expect(items[0].params).toStrictEqual({ type: "png" });
		expect(items[1].params).toStrictEqual({ type: "webp" });
		expect(items[2].params).toStrictEqual({ type: "avif" });
	});

	it("should ignore unprocessable", async () => {
		optimizeRaster.mockResolvedValue(Buffer.alloc(1));
		encodeWebp.mockRejectedValue(new ProcessorError());
		encodeAVIF.mockResolvedValue(Buffer.alloc(1));

		const items = await optimizer.buildCache(saveRequest);
		expect(items).toHaveLength(1);
	});

	it("should save new format only if it smaller than old", async () => {
		optimizeRaster.mockResolvedValue(Buffer.alloc(1));
		encodeWebp.mockResolvedValue(Buffer.alloc(1));
		encodeAVIF.mockResolvedValue(Buffer.alloc(1));

		const items = await optimizer.buildCache(saveRequest);

		expect(items).toHaveLength(1);
		expect(items[0].params).toStrictEqual({ type: "png" });
	});
});

describe("getCache", () => {
	it("should return falsy value if not cache found", () => {
		const item = optimizer.select([], loadRequest);
		return expect(item).toBeFalsy();
	});

	it("should return new format if possible", () => {
		const items = [
			{ type: "webp" },
			{ type: "png" },
			{ type: "avif" },
		];
		const item = optimizer.select(items, loadRequest);

		expect(item).toStrictEqual({ type: "avif" });
	});

	it("should not return unsupported format", () => {
		const items = [
			{ type: "webp" },
			{ type: "png" },
			{ type: "avif" },
		];

		const item = optimizer.select(items, {
			...loadRequest,
			acceptTypes: ["webp"],
		});

		expect(item).toStrictEqual({ type: "webp" });
	});

	it("should fallback to original format", async () => {
		const items = [{ type: "png" }];
		const item = optimizer.select(items, loadRequest);

		expect(item).toStrictEqual({ type: "png" });
	});

	it("should not select unrelated type", () => {
		const items = [{ type: "foobar" }];
		const item = optimizer.select(items, loadRequest);
		return expect(item).toBeFalsy();
	});
});
