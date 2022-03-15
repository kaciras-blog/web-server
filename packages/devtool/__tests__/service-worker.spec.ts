import { expect, it } from "vitest";
import { resolveFixture, runVite } from "./test-utils";
import SWPlugin from "../lib/plugin/service-worker";
import { readFileSync } from "fs";

it("should emit the service worker chunk", async () => {
	await runVite({
		build: {
			rollupOptions: {
				input: "entry-images.js",
			},
		},
		plugins: [
			SWPlugin({ src: resolveFixture("sw.js") }),
		],
	});

	expect(readFileSync("dist/sw.js", "utf8")).toMatchSnapshot();
});
