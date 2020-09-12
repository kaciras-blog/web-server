import path from "path";
import fs from "fs-extra";
import imageCodec from "../lib/image-codec";
import { BadDataError, ParamsError } from "../lib/errors";

it("should throw ParamsError on unsupported type", () => {
	const buffer = Buffer.from("data is unrelated");
	return expect(imageCodec(buffer, "invalid")).rejects.toBeInstanceOf(ParamsError);
});

// 对于非图片数据的输入，应当抛出 MediaError 异常
describe("For non-image data", () => {
	const buffer = Buffer.from("invalid");

	function testFor(type: string) {
		return expect(imageCodec(buffer, type)).rejects.toBeInstanceOf(BadDataError);
	}

	it("should throw jpg", () => testFor("jpg"));
	it("should throw png", () => testFor("png"));
	it("should throw gif", () => testFor("gif"));
	it("should throw webp", () => testFor("webp"));
});

// 对于损坏的图片数据，应当抛出 MediaError 异常
describe("For bad image", () => {

	async function testFor(srcType: string, targetType: string) {
		const buffer = await fs.readFile(path.join(__dirname, "fixtures", "bad_image." + srcType));
		await expect(imageCodec(buffer, targetType)).rejects.toBeInstanceOf(BadDataError);
	}

	it("should throws on optimize gif", () => testFor("gif", "gif"));

	it("should throws on optimize jpg", () => testFor("jpg", "jpg"));
	it("should throws on jpg to webp", () => testFor("jpg", "webp"));

	it("should throws on optimize png", () => testFor("png", "png"));
	it("should throws on png to webp", () => testFor("png", "webp"));
});

describe("optimization", () => {

	// 这张图片如果用默认的参数转换为webp反而会变大，且失真严重
	it("should effect on particular image", async () => {
		const buffer = await fs.readFile(path.join(__dirname, "fixtures", "color_text_black_bg.png"));
		const result = await imageCodec(buffer, "webp");
		expect(result.length).toBeLessThan(buffer.length / 2);
	});
});
