import fs from "fs-extra";
import os from "os";
import path from "path";
import { buildCache } from "../lib/command/build-image-cache";

const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "test-"));
const NAME = "742c5c7e26d80750f1c32f0bbcf0caab4e41678d03f5d610c3a1057b274b2268.png";

beforeEach(() => {
	fs.emptyDirSync(ROOT);
	fs.ensureDirSync(path.join(ROOT, "image"));
});

it("should generate caches", async () => {
	const picture = fs.readFileSync(path.join(__dirname, "fixtures/color_text_black_bg.png"));
	fs.writeFileSync(path.join(ROOT, "image", NAME), picture);

	await buildCache(ROOT);

	expect(fs.readdirSync(path.join(ROOT, "cache/png"))).toHaveLength(1);
});

it("should skip existing cache files", async () => {
	const name = "742c5c7e26d80750f1c32f0bbcf0caab4e41678d03f5d610c3a1057b274b2268.png";
	const cacheDir = path.join(ROOT, "cache/png/");
	const cacheFile = path.join(cacheDir, name);

	const picture = fs.readFileSync(path.join(__dirname, "fixtures/color_text_black_bg.png"));
	fs.writeFileSync(path.join(ROOT, "image", name), picture);

	fs.ensureDirSync(cacheDir);
	fs.writeFileSync(cacheFile, "");

	await buildCache(ROOT);

	expect(fs.readFileSync(cacheFile)).toHaveLength(0);
});
