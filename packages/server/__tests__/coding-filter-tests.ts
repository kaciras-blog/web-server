import { codingFilter } from "../lib/coding-filter";
import { InvalidImageError } from "../lib/image-filter";

describe("Non-image data", () => {
	const buffer = Buffer.from("invalid");

	it("should throw webp", () => {
		return expect(codingFilter(buffer, "webp")).rejects.toBeInstanceOf(InvalidImageError);
	});

	it("should throw jpeg", async () => {
		return expect(codingFilter(buffer, "jpg")).rejects.toBeInstanceOf(InvalidImageError);
	});

	it("should throw png", async () => {
		return expect(codingFilter(buffer, "png")).rejects.toBeInstanceOf(InvalidImageError);
	});

	it("should throw gif", async () => {
		return expect(codingFilter(buffer, "gif")).rejects.toBeInstanceOf(InvalidImageError);
	});
});

