import { expect, it } from "vitest";
import { readFixture } from "../test-utils";
import PresetCropFilter from "../../lib/image/preset-processor";
import { BadDataError, ParamsError } from "../../lib/errors";

const buffer = readFixture("tile_16x16.png");

it("should pass metadata to preset function", () => {
	const filter = PresetCropFilter({
		test: ((metadata) => {
			expect(metadata.width).toBe(16);
			expect(metadata.height).toBe(16);
			return "0-0-8-8";
		}),
	});

	// Vitest 的类型只能返回 Promise<void>
	return filter(buffer, "test").then();
});

it("should throws on preset not found", () => {
	const filter = PresetCropFilter({});
	return expect(filter(buffer, "_")).rejects.toBeInstanceOf(ParamsError);
});

it("should throws on bad data", () => {
	const filter = PresetCropFilter({ test: () => "0-0-8-8" });
	const badData = Buffer.from("invalid");
	return expect(filter(badData, "test")).rejects.toBeInstanceOf(BadDataError);
});
