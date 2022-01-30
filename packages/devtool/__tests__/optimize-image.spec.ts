import { expect, it } from "vitest";
import { statSync } from "fs";
import { RollupOutput } from "rollup";
import { avoidEmptyChunkTS, getAsset, resolveFixture, runVite } from "./test-utils";
import optimizeImage from "../lib/plugin/optimize-image";

/**
 * 断言指定名称的图片已输出，但未被优化。
 *
 * @param bundle 构建结果
 * @param name 文件名
 */
async function expectUnoptimized(bundle: RollupOutput, name: string) {
	const source = statSync(resolveFixture(name));
	expect(getAsset(bundle, name).length).toStrictEqual(source.size);
}

/**
 * 断言指定名称的图片已输出，且已被优化，大小小于原始的文件。
 *
 * @param bundle 构建结果
 * @param name 输出文件名
 * @param srcName 原始文件名，没有则与输出名相同
 */
async function expectSmaller(bundle: RollupOutput, name: string, srcName = name) {
	const source = statSync(resolveFixture(srcName));
	expect(getAsset(bundle, name).length).toBeLessThan(source.size);
}

function optimize(input: string, include?: RegExp) {
	return runVite({
		build: {
			rollupOptions: { input },
		},
		plugins: [
			avoidEmptyChunkTS(),
			optimizeImage(include),
		],
	});
}

it("should compress images", async () => {
	const bundle = await optimize("test.png");

	// 1 个图片输出，1 个额外的 WebP，1 个入口文件。
	expect(bundle.output).toHaveLength(3);
	await expectSmaller(bundle, "test.png");
	await expectSmaller(bundle, "test.webp", "test.png");
});

it("should optimize SVG", async () => {
	const bundle = await optimize("visible-off.svg");

	// 1 个图片输出，1 个入口文件。
	expect(bundle.output).toHaveLength(2);
	await expectSmaller(bundle, "visible-off.svg");
});

it("should include files matches the regexp", async () => {
	const bundle = await optimize("entry-images.js", /\.gif$/);

	await expectSmaller(bundle, "tantrum.gif");
	await expectUnoptimized(bundle, "visible-off.svg");
	await expectUnoptimized(bundle, "test.png");
});
