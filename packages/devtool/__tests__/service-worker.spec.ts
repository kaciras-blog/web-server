import { readFileSync } from "fs";
import { join } from "path";
import { expect, it } from "vitest";
import { resolveFixture, runVite, useTempDirectory } from "./test-utils";
import SWPlugin from "../lib/plugin/service-worker";

const outDir = useTempDirectory();

it("should emit the service worker chunk", async () => {
	await runVite({
		build: {
			outDir,
			rollupOptions: {
				input: "entry-images.js",
			},
		},
		plugins: [
			SWPlugin({ src: resolveFixture("sw.js") }),
		],
	});

	expect(readFileSync(join(outDir, "sw.js"), "utf8")).toMatchSnapshot();
});
