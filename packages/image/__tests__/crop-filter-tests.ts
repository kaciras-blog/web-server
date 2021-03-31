import fs from "fs-extra";
import path from "path";
import sharp from "sharp";
import PresetCropFilter from "../lib/crop-filter";
import { BadImageError, FilterArgumentError } from "../lib/errors";

const buffer = fs.readFileSync(path.join(__dirname, "fixtures", "tile_16x16.png"));

it("should pass metadata to preset function", () => {
	const filter = PresetCropFilter({
		test: ((metadata) => {
			expect(metadata.height).toBe(16);
			expect(metadata.width).toBe(16);
			return { left: 0, top: 0, width: 8, height: 8 };
		}),
	});
	return filter(buffer, "test");
});

it("should crop image", async () => {
	const filter = PresetCropFilter({
		test: (() => ({ left: 0, top: 0, width: 8, height: 8 })),
	});

	// PNG 的压缩编码可能因依赖升级而变动，故此处转换为像素验证
	const cropped = await filter(buffer, "test");
	const pixels = await sharp(cropped).raw().toBuffer();

	expect(pixels).toHaveLength(256); // 8(width) x 8(height) x 4(RGBA)
	pixels.forEach(bit8 => expect(bit8).toBe(0)); // all pixels are rgba(0,0,0,0)
});

it("should throws on preset not found", () => {
	const filter = PresetCropFilter({});
	return expect(filter(buffer, "_")).rejects.toBeInstanceOf(FilterArgumentError);
});

it("should throws on bad data", () => {
	const filter = PresetCropFilter({
		test: (() => ({ left: 0, top: 0, width: 8, height: 8 })),
	});
	const badData = Buffer.from("invalid");
	return expect(filter(badData, "test")).rejects.toBeInstanceOf(BadImageError);
});
