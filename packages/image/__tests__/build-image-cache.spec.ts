import os from "os";
import path from "path";
import fs from "fs-extra";
import { buildCache } from "../lib/build-image-cache";

const tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), "test-"));

beforeEach(() => fs.emptyDir(tmpdir));

it('should generate caches', async () => {
	const picture = fs.readFileSync(path.join(__dirname, "fixtures/color_text_black_bg.png"));
	fs.writeFileSync(path.join(tmpdir, "742c5c7e26d80750f1c32f0bbcf0caab4e41678d03f5d610c3a1057b274b2268.png"), picture);

	await buildCache(tmpdir);

	expect(fs.readdirSync(path.join(tmpdir, "cache/png"))).toHaveLength(1);
});

it('should skip existing cache files', async () => {
	const name = "742c5c7e26d80750f1c32f0bbcf0caab4e41678d03f5d610c3a1057b274b2268.png";
	const cacheDir = path.join(tmpdir, "cache/png/");
	const cacheFile = path.join(cacheDir, name);

	const picture = fs.readFileSync(path.join(__dirname, "fixtures/color_text_black_bg.png"));
	fs.writeFileSync(path.join(tmpdir, name), picture);

	fs.ensureDirSync(cacheDir);
	fs.writeFileSync(cacheFile, "");

	await buildCache(tmpdir);

	expect(fs.readFileSync(cacheFile)).toHaveLength(0);
});
