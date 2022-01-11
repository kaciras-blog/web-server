import path from "path";
import fs from "fs-extra";
import { Configuration, StatsCompilation } from "webpack";
import MemoryFs from "memory-fs";
import CompressionPlugin from "compression-webpack-plugin";
import CopyPlugin from "copy-webpack-plugin";
import ImageOptimizePlugin from "../lib/webpack/ImageOptimizePlugin";
import { resolveFixture, runWebpack } from "./test-utils";

/**
 * 断言指定名称的图片已输出，但未被优化。
 *
 * @param stats 构建结果
 * @param name 文件名
 */
async function expectUnoptimized(stats: StatsCompilation, name: string) {
	const source = await fs.stat(resolveFixture(name));
	const optimized = stats.assets!.find(a => a.name === name);

	expect(optimized).toBeDefined();
	expect(optimized!.size).toStrictEqual(source.size);
}

/**
 * 断言指定名称的图片已输出，且已被优化，大小小于原始的文件。
 *
 * @param stats 构建结果
 * @param name 输出文件名
 * @param srcName 原始文件名，没有则与输出名相同
 */
async function expectSmallerSize(stats: StatsCompilation, name: string, srcName = name) {
	const source = await fs.stat(resolveFixture(srcName));
	const optimized = stats.assets!.find(a => a.name === name);

	expect(optimized).toBeDefined();
	expect(optimized!.size).toBeLessThan(source.size);
}

const baseConfig: Configuration = {
	entry: resolveFixture("entry-images.js"),
	module: {
		rules: [
			{
				test: /\.(png|jpg|gif|webp)$/,
				type: "asset/resource",
				generator: {
					filename: "[name][ext]",
				},
			},
			{
				test: /\.svg$/,
				type: "asset/resource",
				generator: {
					filename: "[name][ext]",
				},
			},
		],
	},
};

it("should compress images", async () => {
	const config = {
		plugins: [new ImageOptimizePlugin()],
	};
	const stats = await runWebpack({ ...baseConfig, ...config });

	// 断言没有生成多余的文件，3 个图片输出，1个额外的 WebP，1 个入口文件。
	expect(stats.assets).toHaveLength(5);

	await expectSmallerSize(stats, "visible-off.svg");
	await expectSmallerSize(stats, "test.png");
	await expectSmallerSize(stats, "tantrum.gif");
});

it("should include files matches the regexp", async () => {
	const config = {
		plugins: [new ImageOptimizePlugin(/\.gif$/)],
	};
	const stats = await runWebpack({ ...baseConfig, ...config });

	await expectUnoptimized(stats, "visible-off.svg");
	await expectUnoptimized(stats, "test.png");
	await expectSmallerSize(stats, "tantrum.gif");
});

it("should generate additional webp file", async () => {
	const config = {
		plugins: [new ImageOptimizePlugin(/\.png$/)],
	};
	const stats = await runWebpack({ ...baseConfig, ...config });

	await expectSmallerSize(stats, "test.webp", "test.png");
});

/**
 * 实际使用中 ImageOptimizePlugin 还要求能够接收前面插件引入的图片，并且结果要能被后面的插件所使用。
 */
it("should cooperate with other plugins", async () => {
	const config: Configuration = {
		entry: resolveFixture("entry-empty.js"),
		plugins: [
			new CopyPlugin({
				patterns: [{
					from: "visible-off.svg",
					to: "visible-off.svg",
					context: path.join(__dirname, "fixtures"),
				}],
			}),
			new ImageOptimizePlugin(),
			new CompressionPlugin({ test: /\.svg$/ }),
		],
	};

	const output = new MemoryFs();
	const stats = await runWebpack(config, output);

	const files = output.readdirSync("/").sort();
	expect(files).toEqual(["main.js", "visible-off.svg", "visible-off.svg.gz"]);

	await expectSmallerSize(stats, "visible-off.svg");
});
