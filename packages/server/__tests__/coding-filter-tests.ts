import path from "path";
import fs from "fs-extra";
import { InvalidImageError } from "../lib/image-filter";
import codingFilter from "../lib/coding-filter";

// 对于非图片数据的输入，应当抛出 InvalidImageError 异常
describe("Non-image data", () => {
	const buffer = Buffer.from("invalid");

	function testFor(type: string) {
		return expect(codingFilter(buffer, type)).rejects.toBeInstanceOf(InvalidImageError);
	}

	it("should throw jpg", () => testFor("jpg"));
	it("should throw png", () => testFor("png"));
	it("should throw gif", () => testFor("gif"));
	it("should throw webp", () => testFor("webp"));
});

// 对于损坏的图片数据，应当抛出 InvalidImageError 异常
describe("Bad image", () => {

	async function testFor(srcType: string, targetType: string) {
		const buffer = await fs.readFile(path.join(__dirname, "resources", "bad_image." + srcType));
		await expect(codingFilter(buffer, targetType)).rejects.toBeInstanceOf(InvalidImageError);
	}

	it("should throws on optimize gif", () => testFor("gif", "gif"));

	it("should throws on optimize jpg", () => testFor("jpg", "jpg"));
	it("should throws on jpg to webp", () => testFor("jpg", "webp"));

	it("should throws on optimize png", () => testFor("png", "png"));
	it("should throws on png to webp", () => testFor("png", "webp"));
});

describe("optimization", () => {

	// 这张图片如果默认的参数来转换为webp反而会变大，且失真严重
	it("should effect on particular image", async () => {
		const buffer = await fs.readFile(path.join(__dirname, "resources", "color_text_black_bg.png"));
		const result = await codingFilter(buffer, "webp");
		expect(result.length).toBeLessThan(buffer.length / 2);
	});
});
