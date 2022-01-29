import { readFileSync } from "fs";
import { expect, it } from "vitest";
import { avoidEmptyChunkTS, getAsset, resolveFixture, runVite } from "./test-utils";
import { compressAssets } from "../lib";

const bigSvg = readFileSync(resolveFixture("big.svg"));
const scriptJs = readFileSync(resolveFixture("script.js"));

it("should skip small files", async () => {
	const bundle = await runVite({
		build: {
			rollupOptions: {
				input: "instruction.svg",
			},
		},
		plugins: [
			avoidEmptyChunkTS(),
			compressAssets({ algorithm: "gz" }),
		],
	});

	expect(bundle.output).toHaveLength(2);
});

it("should not skip incompressible files", async () => {
	const bundle = await runVite({
		build: {
			rollupOptions: {
				input: "test.png",
			},
		},
		plugins: [
			avoidEmptyChunkTS(),
			compressAssets({ algorithm: "gz" }),
		],
	});

	expect(bundle.output).toHaveLength(2);
});

it("should compress assets", async () => {
	const bundle = await runVite({
		build: {
			rollupOptions: {
				input: "big.svg",
			},
		},
		plugins: [
			avoidEmptyChunkTS(),
			compressAssets({ algorithm: "gz" }),
			compressAssets({ algorithm: "br" }),
		],
	});

	expect(bundle.output).toHaveLength(4);

	const gzipped = getAsset(bundle, "big.svg.gz");
	expect(gzipped.length).toBeLessThan(bigSvg.length);

	const brotli = getAsset(bundle, "big.svg.br");
	expect(brotli.length).toBeLessThan(gzipped.length);
});

it("should compress chunks", async () => {
	const bundle = await runVite({
		build: {
			rollupOptions: {
				input: "script.js",
			},
		},
		plugins: [
			compressAssets({ algorithm: "gz" }),
		],
	});

	expect(bundle.output).toHaveLength(2);

	const gzipped = getAsset(bundle, "script.js.gz");
	expect(gzipped.length).toBeLessThan(scriptJs.length);
});

it("should only run at client build", async () => {
	const bundle = await runVite({
		build: {
			rollupOptions: {
				input: "script.js",
			},
			ssr: true,
		},
		plugins: [
			avoidEmptyChunkTS(),
			compressAssets({ algorithm: "gz" }),
		],
	});

	expect(bundle.output).toHaveLength(1);
});

it("should discard files with bad compress ratio",async () => {
	const bundle = await runVite({
		assetsInclude: "**/*.data",
		build: {
			assetsInlineLimit: 0,
			rollupOptions: {
				input: "random.data",
			},
		},
		plugins: [
			avoidEmptyChunkTS(),
			compressAssets({ algorithm: "gz" }),
		],
	});
	expect(bundle.output).toHaveLength(2);
});
