import { tmpdir } from "os";
import { join } from "path";
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "fs";
import { afterEach, expect, it } from "vitest";
import buildCache from "../../lib/command/build-cache.js";
import { readFixture } from "../test-utils.js";

const root = mkdtempSync(join(tmpdir(), "test-"));
const nameRaster = "maoG0wFHmNhgAcMkRo1J.png";
const nameSVG = "123456789abcdefghijk.svg";

const config = {
	app: {
		dataDir: {
			data: join(root, "data"),
			cache: join(root, "cache"),
		},
	},
};

afterEach(() => {
	rmSync(root, { recursive: true });
});

it("should generate caches", async () => {
	const src = join(config.app.dataDir.data, "image");
	mkdirSync(src, { recursive: true });

	writeFileSync(join(src, nameRaster), readFixture("color_text_black_bg.png"));
	writeFileSync(join(src, nameSVG), readFixture("digraph.svg"));

	await buildCache(config);

	const dist = join(config.app.dataDir.cache, "image");
	expect(readdirSync(join(dist, "maoG0wFHmNhgAcMkRo1J"))).toHaveLength(2);
	expect(readdirSync(join(dist, "123456789abcdefghijk"))).toHaveLength(3);
});
