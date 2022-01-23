import { expect, it } from "vitest";
import fs from "fs-extra";
import { build, InlineConfig } from "vite";
import { RollupOutput } from "rollup";
import { resolveFixture, testEntry } from "./test-utils";
import optimizeImage from "../lib/plugin/optimize-image";

/**
 * 断言指定名称的图片已输出，但未被优化。
 *
 * @param bundle 构建结果
 * @param name 文件名
 */
async function expectUnoptimized(bundle: RollupOutput, name: string) {
	const source = await fs.stat(resolveFixture(name));
	const optimized = bundle.output.find(a => a.fileName === name);

	if (!optimized) {
		return expect.fail(`${name} is not in the bundle`);
	}
	if (optimized.type !== "asset") {
		return expect.fail(`${name} is not a asset`);
	}
	expect(optimized.source.length).toStrictEqual(source.size);
}

/**
 * 断言指定名称的图片已输出，且已被优化，大小小于原始的文件。
 *
 * @param bundle 构建结果
 * @param name 输出文件名
 * @param srcName 原始文件名，没有则与输出名相同
 */
async function expectSmaller(bundle: RollupOutput, name: string, srcName = name) {
	const source = await fs.stat(resolveFixture(srcName));
	const optimized = bundle.output.find(a => a.fileName === name);

	if (!optimized) {
		return expect.fail(`${name} is not in the bundle`);
	}
	if (optimized.type !== "asset") {
		return expect.fail(`${name} is not a asset`);
	}
	expect(optimized.source.length).toBeLessThan(source.size);
}

export function runVite(config: InlineConfig, entry?: string) {
	const base: InlineConfig = {
		logLevel: "warn",
		build: {
			rollupOptions: {
				input: entry,
				output: {
					assetFileNames: "[name].[ext]",
				},
			},
			write: false,
		},
	};
	return build({ ...base, ...config }) as Promise<RollupOutput>;
}

it("should compress images", async () => {
	const bundle = await runVite({
		plugins: [
			optimizeImage(),
			testEntry('import img from "./test.png"'),
		],
	});

	// 1 个图片输出，1 个额外的 WebP，1 个入口文件。
	expect(bundle.output).toHaveLength(3);
	await expectSmaller(bundle, "test.png");
	await expectSmaller(bundle, "test.webp", "test.png");
});

it("should optimize SVG", async () => {
	const bundle = await runVite({
		plugins: [
			optimizeImage(),
			testEntry('import img from "./visible-off.svg"'),
		],
	});

	// 1 个图片输出，1 个入口文件。
	expect(bundle.output).toHaveLength(2);
	await expectSmaller(bundle, "visible-off.svg");
});

it("should include files matches the regexp", async () => {
	const bundle = await runVite({
		plugins: [
			optimizeImage(/\.gif$/),
		],
	}, resolveFixture("entry-images.js"));

	await expectSmaller(bundle, "tantrum.gif");
	await expectUnoptimized(bundle, "visible-off.svg");
	await expectUnoptimized(bundle, "test.png");
});
