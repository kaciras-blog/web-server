import { tmpdir } from "os";
import { join } from "path";
import fs from "fs";
import { afterEach, expect, it } from "vitest";
import buildCache from "../../lib/command/build-cache";
import { readFixture } from "../test-utils";

const root = fs.mkdtempSync(join(tmpdir(), "test-"));
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
	fs.rmSync(root, { recursive: true });
});

it("should generate caches", async () => {
	const src = join(config.app.dataDir.data, "image");
	fs.mkdirSync(src, { recursive: true });

	fs.writeFileSync(join(src, nameRaster), readFixture("color_text_black_bg.png"));
	fs.writeFileSync(join(src, nameSVG), readFixture("digraph.svg"));

	await buildCache(config as any);

	const dist = join(config.app.dataDir.cache, "image");
	expect(fs.readdirSync(join(dist, "maoG0wFHmNhgAcMkRo1J"))).toHaveLength(2);
	expect(fs.readdirSync(join(dist, "123456789abcdefghijk"))).toHaveLength(3);
});
