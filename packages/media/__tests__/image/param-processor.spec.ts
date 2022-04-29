import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { crop, flip, ParamsError, resize, rotate } from "../../lib/index";
import { readFixture } from "../test-utils";

const buffer = readFixture("tile_16x16.png");

describe("crop", () => {
	it.each([
		"_INVALID_",
		"",
		"a-b-c-d",
	])("should throw on invalid parameter %#", (arg) => {
		expect(() => crop(sharp(), arg)).toThrow(ParamsError);
	});

	it("should crop the image", async () => {
		const cropped = crop(sharp(buffer), "0-0-8-8");
		const pixels = await cropped.raw().toBuffer();

		// PNG 的压缩编码可能因依赖升级而变动，故此处采用为像素验证
		expect(pixels).toHaveLength(256); // 8(width) x 8(height) x 4(RGBA)
		pixels.forEach(bit8 => expect(bit8).toBe(0));
	});
});

describe("flip", () => {
	it.each([
		"_INVALID_",
		"",
		"YY",
		"XYX",
	])("should throw on invalid parameter %#", (arg) => {
		expect(() => flip(sharp(), arg)).toThrow(ParamsError);
	});

	it("should flip the image", async () => {
		const cropped = flip(sharp(buffer), "X");
		const raw = await cropped.raw().toBuffer();

		const pixels = new Uint32Array(raw.buffer);
		expect(pixels[0]).toBe(0xFF000000);
		expect(pixels[15]).toBe(0);
		expect(pixels[240]).toBe(0);
		expect(pixels[255]).toBe(0xFFFFFFFF);
	});
});

describe("rotate", () => {
	it.each([
		"_INVALID_",
		"",
	])("should throw on invalid parameter %#", (arg) => {
		expect(() => rotate(sharp(), arg)).toThrow(ParamsError);
	});

	it("should rotate the image", async () => {
		const cropped = rotate(sharp(buffer), "90");
		const raw = await cropped.raw().toBuffer();

		const pixels = new Uint32Array(raw.buffer);
		expect(pixels[0]).toBe(0xFFFFFFFF);
		expect(pixels[15]).toBe(0);
		expect(pixels[240]).toBe(0);
		expect(pixels[255]).toBe(0xFF000000);
	});
});

describe("resize", () => {
	it.each([
		"_INVALID_",
		"",
	])("should throw on invalid parameter %#", (arg) => {
		expect(() => resize(sharp(), arg)).toThrow(ParamsError);
	});
});
