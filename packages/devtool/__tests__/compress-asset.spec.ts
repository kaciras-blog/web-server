import { readdirSync, readFileSync, statSync } from "fs";
import { expect, it } from "vitest";
import { avoidEmptyChunkTS, resolveFixture, runVite, useTempDirectory } from "./test-utils";
import { compressAssets } from "../lib";
import { join } from "path";

const bigSvg = readFileSync(resolveFixture("big.svg"));
const scriptJs = readFileSync(resolveFixture("script.js"));

const outDir = useTempDirectory();

function getSize(name: string) {
	return statSync(join(outDir, name)).size;
}

it("should skip small files", async () => {
	await runVite({
		build: {
			write: true,
			outDir,
			rollupOptions: {
				input: "instruction.svg",
			},
		},
		plugins: [
			avoidEmptyChunkTS(),
			compressAssets({ algorithm: "gz" }),
		],
	});

	expect(readdirSync(outDir)).toHaveLength(2);
});

it("should not skip incompressible files", async () => {
	await runVite({
		build: {
			write: true,
			outDir,
			rollupOptions: {
				input: "test.png",
			},
		},
		plugins: [
			avoidEmptyChunkTS(),
			compressAssets({ algorithm: "gz" }),
		],
	});

	expect(readdirSync(outDir)).toHaveLength(2);
});

it("should compress assets", async () => {
	await runVite({
		build: {
			write: true,
			outDir,
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

	expect(readdirSync(outDir)).toHaveLength(4);

	const gzipSize = getSize("big.svg.gz");
	expect(gzipSize).toBeLessThan(bigSvg.length);

	const brotliSize = getSize("big.svg.br");
	expect(brotliSize).toBeLessThan(gzipSize);
});

it("should compress chunks", async () => {
	await runVite({
		build: {
			write: true,
			outDir,
			rollupOptions: {
				input: "script.js",
			},
		},
		plugins: [
			compressAssets({ algorithm: "gz" }),
		],
	});

	expect(readdirSync(outDir)).toHaveLength(2);

	const gzipSize = getSize("script.js.gz");
	expect(gzipSize).toBeLessThan(scriptJs.length);
});

it("should only run at client build", async () => {
	await runVite({
		build: {
			write: true,
			outDir,
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

	expect(readdirSync(outDir)).toHaveLength(1);
});

it("should discard files with bad compress ratio", async () => {
	await runVite({
		assetsInclude: "**/*.data",
		build: {
			write: true,
			outDir,
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

	expect(readdirSync(outDir)).toHaveLength(2);
});
