import fs from "fs-extra";
import path from "path";
import PresetCropFilter from "../lib/crop-filter";
import { BadImageError, FilterArgumentError } from "../lib/errors";

const buffer = fs.readFileSync(path.join(__dirname, "fixtures", "tile_16x16.png"));

const transparent8x8 = Buffer.from(
	"iVBORw0KGgoAAAANSUhEUgAAAAgAAAA" +
	"ICAYAAADED76LAAAACXBIWXMAAAsSAA" +
	"ALEgHS3X78AAAADUlEQVQY02NgGAUgA" +
	"AABCAABzu35wgAAAABJRU5ErkJggg==", "base64");

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
	const cropped = await filter(buffer, "test");
	expect(cropped).toStrictEqual(transparent8x8);
});

it("should throws on preset not found", () => {
	const filter = PresetCropFilter({});
	expect(filter(buffer, "_")).rejects.toBeInstanceOf(FilterArgumentError);
});

it("should throws on bad data", () => {
	const filter = PresetCropFilter({
		test: (() => ({ left: 0, top: 0, width: 8, height: 8 })),
	});
	const badData = Buffer.from("invalid");
	expect(filter(badData, "test")).rejects.toBeInstanceOf(BadImageError);
});
