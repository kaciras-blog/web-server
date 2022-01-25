import { expect, it, vi } from "vitest";
import { getAsset, runVite, testEntry } from "./test-utils";
import processImage from "../lib/plugin/process-image";

vi.mock("@kaciras-blog/media", () => ({
	createPresetCropper: () => vi.fn(async () => Buffer.alloc(3)),
}));

it("should crop the image", async () => {
	const bundle = await runVite({
		plugins: [
			processImage(),
			testEntry("import s from './test.png?size=IndexBannerM'; window.s=s"),
		],
	});

	expect(bundle.output[0].code).toMatchSnapshot();
	expect(getAsset(bundle, "test.png")).toHaveLength(3);
});
