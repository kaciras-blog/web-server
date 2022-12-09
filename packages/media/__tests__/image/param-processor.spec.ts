import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { crop, flip, ParamsError, resize, rotate } from "../../lib/index.js";
import { readFixture } from "../test-utils.js";

const buffer = readFixture("tile_16x16.png");

/**
 * 断言 tile_16x16 这张图四个区域的颜色。
 *
 * 黑色 - 0xFF000000
 * 白色 - 0xFFFFFFFF
 * 透明 - 0
 *
 * @param data 像素数组
 * @param tl 左上
 * @param tr 右上
 * @param bl 左下
 * @param br 右下
 */
function assertTiles(data: Buffer, tl: number, tr: number, bl: number, br: number) {
	const pixels = new Uint32Array(data.buffer);
	expect(pixels[0]).toBe(tl);
	expect(pixels[15]).toBe(tr);
	expect(pixels[240]).toBe(bl);
	expect(pixels[255]).toBe(br);
}

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

	it("should flip the image about X axis", async () => {
		const cropped = flip(sharp(buffer), "X");
		const raw = await cropped.raw().toBuffer();

		assertTiles(raw, 0xFF000000, 0, 0, 0xFFFFFFFF);
	});

	it("should flip the image about Y axis", async () => {
		const cropped = flip(sharp(buffer), "Y");
		const raw = await cropped.raw().toBuffer();

		assertTiles(raw, 0xFFFFFFFF, 0, 0, 0xFF000000);
	});

	it("should flip the image both X & Y axis", async () => {
		const cropped = flip(sharp(buffer), "YX");
		const raw = await cropped.raw().toBuffer();

		assertTiles(raw, 0, 0xFFFFFFFF, 0xFF000000, 0);
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

		assertTiles(raw, 0xFFFFFFFF, 0, 0, 0xFF000000);
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
