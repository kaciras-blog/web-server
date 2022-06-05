import { describe, expect, it } from "vitest";
import { fileTypeFromBuffer } from "file-type";
import sharp from "sharp";
import { readFixture } from "../test-utils";
import { BadDataError, encodeAVIF, encodeWebp, optimizeRaster, ParamsError, ProcessorError } from "../../lib";

it("should throw ParamsError on unsupported type", () => {
	const buffer = Buffer.from("data is unrelated");
	return expect(optimizeRaster(buffer, "invalid")).rejects.toBeInstanceOf(ParamsError);
});

// 对于非图片数据的输入，应当抛出 MediaError 异常
describe("For non-image data", () => {
	const buffer = Buffer.from("invalid");

	function testFor(type: string) {
		return expect(optimizeRaster(buffer, type)).rejects.toBeInstanceOf(BadDataError);
	}

	it("should fail when encode to jpg", () => testFor("jpg"));
	it("should fail when encode to png", () => testFor("png"));
	it("should fail when encode to gif", () => testFor("gif"));

	it("should fail when encode to WebP", () => {
		expect(encodeWebp(buffer)).rejects.toBeInstanceOf(BadDataError);
	});

	it("should fail when encode to AVIF", () => {
		expect(encodeAVIF(buffer)).rejects.toBeInstanceOf(BadDataError);
	});
});

// 对于损坏的图片数据，应当抛出 MediaError 异常
describe("For bad image", () => {
	const badPng = readFixture("bad_image.png");

	async function testFor(srcType: string, targetType: string) {
		const buffer = readFixture("bad_image." + srcType);
		await expect(optimizeRaster(buffer, targetType)).rejects.toBeInstanceOf(BadDataError);
	}

	it("should fail with bad jpg", () => testFor("jpg", "jpg"));
	it("should fail with bad png", () => testFor("png", "png"));
	it("should fail with bad gif", () => testFor("gif", "gif"));

	it("should fail when encode to WebP", () => {
		expect(encodeWebp(badPng)).rejects.toBeInstanceOf(BadDataError);
	});

	it("should fail when encode to AVIF", () => {
		expect(encodeAVIF(badPng)).rejects.toBeInstanceOf(BadDataError);
	});
});

describe("optimization", () => {
	const gif = readFixture("test.gif");
	const jpg = readFixture("test.jpg");
	const png = readFixture("test.png");

	const colorText = readFixture("color_text_black_bg.png");

	it("should optimize jpg files", async () => {
		const result = await optimizeRaster(jpg, "jpg");

		expect((await fileTypeFromBuffer(result))?.mime).toBe("image/jpeg");
		expect(result.length).toBeLessThan(jpg.length);
	});

	it("should optimize gif files", async () => {
		const result = await optimizeRaster(gif, "gif");

		expect((await fileTypeFromBuffer(result))?.mime).toBe("image/gif");
		expect(result.length).toBeLessThan(gif.length);
	});

	it("should optimize png files", async () => {
		const result = await optimizeRaster(png, "png");

		expect((await fileTypeFromBuffer(result))?.mime).toBe("image/png");
		expect(result.length).toBeLessThan(png.length);
	});

	// 这张图片如果用默认的参数转换为 WebP 反而会变大，且失真严重
	it("should effect on particular image", async () => {
		const result = await encodeWebp(colorText);

		expect((await fileTypeFromBuffer(result))?.mime).toBe("image/webp");
		expect(result.length).toBeLessThan(colorText.length / 2);
	});

	it("should convert the image to AVIF", async () => {
		const result = await encodeAVIF(colorText);

		expect((await fileTypeFromBuffer(result))?.mime).toBe("image/avif");
		expect(result.length).toBeLessThan(colorText.length / 2);
	});

	// GIF 转 WebP 效果不理想（见下面一个用例），故暂不支持。
	it("should not support GIF to WebP", () => {
		return expect(encodeWebp(gif)).rejects.toThrow(ProcessorError);
	});

	// 实测 GIF 转 WebP 的效果。
	it("has bad compression ratio in GIF", async () => {
		const result = await sharp(gif, { pages: -1 })
			.webp({ quality: 40, smartSubsample: true })
			.toBuffer();

		expect((await fileTypeFromBuffer(result))?.mime).toBe("image/webp");
		expect(result.length).toBeLessThan(gif.length * 0.7);
	});

	// GIF 转 AVIF 效果也不理想。
	it("should not support GIF to WebP", () => {
		return expect(encodeAVIF(gif)).rejects.toThrow(ProcessorError);
	});
});
