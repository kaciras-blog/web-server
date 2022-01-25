import { expect, it } from "vitest";
import sharp from "sharp";
import { crop, ParamsError, resize } from "../../lib";
import { readFixture } from "../test-utils";

const buffer = readFixture("tile_16x16.png");

it("should throw on invalid crop parameter", () => {
	expect(() => crop(sharp(), "_INVALID_")).toThrow(ParamsError);
});

it("should throw on invalid resize parameter", () => {
	expect(() => resize(sharp(), "_INVALID_")).toThrow(ParamsError);
});

it("should crop the image", async () => {
	// PNG 的压缩编码可能因依赖升级而变动，故此处转换为像素验证
	const cropped = await crop(sharp(buffer), "0-0-8-8");
	const pixels = await cropped.raw().toBuffer();

	expect(pixels).toHaveLength(256); // 8(width) x 8(height) x 4(RGBA)
	pixels.forEach(bit8 => expect(bit8).toBe(0));
});
