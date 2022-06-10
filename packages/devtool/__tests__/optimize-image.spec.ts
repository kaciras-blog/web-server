import { readFileSync, statSync } from "fs";
import { expect, it, vi } from "vitest";
import { RollupOutput } from "rollup";
import { RasterOptimizer, SVGOptimizer } from "@kaciras-blog/media";
import { avoidEmptyChunkTS, getAsset, resolveFixture, runVite } from "./test-utils";
import optimizeImage from "../lib/plugin/optimize-image";

const buildRaster = vi.spyOn(RasterOptimizer.prototype, "buildCache");
const buildSVG = vi.spyOn(SVGOptimizer.prototype, "buildCache");

/**
 * 断言指定名称的图片已输出，但未被优化。
 *
 * @param bundle 构建结果
 * @param name 文件名
 */
function expectUnoptimized(bundle: RollupOutput, name: string) {
	const source = statSync(resolveFixture(name));
	expect(getAsset(bundle, name).length).toStrictEqual(source.size);
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
	buildRaster.mockResolvedValue(
		[{ data: Buffer.from("111"), params: { type: "foo" } }],
	);

	await optimize("test.png");

	expect(buildRaster).toHaveBeenCalledOnce();
	expect(buildRaster).toHaveBeenCalledWith({
		type: "png",
		parameters: {},
		buffer: readFileSync(resolveFixture("test.png")),
	});
});

it("should emit additional files", async () => {
	buildRaster.mockResolvedValue(
		[{ data: Buffer.from("111"), params: { type: "foo" } }],
	);

	const bundle = await optimize("test.png");

	// 1 个优化后的，1 个原始图片，1 个入口文件。
	expect(bundle.output).toHaveLength(3);
	expectUnoptimized(bundle, "test.png");
	expect(getAsset(bundle, "test.foo")).toStrictEqual(Buffer.from("111"));
});

it("should override original if needed", async () => {
	buildRaster.mockResolvedValue(
		[{ data: Buffer.from("111"), params: { type: "png" } }],
	);

	const bundle = await optimize("test.png");

	// 1 个优化后的，1 个入口文件。
	expect(bundle.output).toHaveLength(2);
	expect(getAsset(bundle, "test.png")).toStrictEqual(Buffer.from("111"));
});

it("should append encoding suffix", async () => {
	buildSVG.mockResolvedValue(
		[{ data: Buffer.from("111"), params: { type: "svg", encoding: "gzip" } }],
	);

	const bundle = await optimize("visible-off.svg");

	// 1 个优化后的，1 个原始图片，1 个入口文件。
	expect(bundle.output).toHaveLength(3);
	expect(getAsset(bundle, "visible-off.svg.gz")).toStrictEqual(Buffer.from("111"));
});

it("should include files matches the regexp", async () => {
	buildRaster.mockResolvedValue(
		[{ data: Buffer.from("111"), params: { type: "gif" } }],
	);

	const bundle = await optimize("entry-images.js", /\.gif$/);

	expectUnoptimized(bundle, "visible-off.svg");
	expectUnoptimized(bundle, "test.png");
	expect(getAsset(bundle, "tantrum.gif")).toStrictEqual(Buffer.from("111"));
});
