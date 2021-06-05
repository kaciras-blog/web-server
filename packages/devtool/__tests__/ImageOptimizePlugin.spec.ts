import path from "path";
import MemoryFs from "memory-fs";
import fs from "fs-extra";
import CopyWebpackPlugin from "copy-webpack-plugin";
import CompressionPlugin from "compression-webpack-plugin";
import ImageOptimizePlugin from "../lib/webpack/ImageOptimizePlugin";
import { resolveFixture, runWebpack } from "./test-utils";

/**
 * 断言指定名称的图片已输出，但未被优化。
 *
 * @param output 输出的内存文件系统
 * @param name 文件名
 */
async function expectUnoptimized(output: MemoryFs, name: string) {
	const source = await fs.readFile(resolveFixture(name));
	const optimized = output.readFileSync("/" + name);
	expect(optimized).toStrictEqual(source);
}

/**
 * 断言指定名称的图片已输出，且已被优化。
 *
 * @param output 输出的内存文件系统
 * @param name 文件名
 */
async function expectSmallerSize(output: MemoryFs, name: string) {
	const source = await fs.stat(resolveFixture(name));
	const optimized = output.readFileSync("/" + name);
	expect(optimized.length).toBeLessThan(source.size);
}

it("should compress images", async () => {
	const output = await runWebpack({
		entry: resolveFixture("entry-images.js"),
		output: {
			path: "/",
		},
		module: {
			rules: [
				{
					test: /\.(svg|png|jpe?g|gif|webp)(\?.*)?$/,
					loader: "file-loader",
					options: {
						name: "/[name].[ext]",
					},
				},
			],
		},
		plugins: [
			new ImageOptimizePlugin(),
		],
	});

	// 断言没有生成多余的文件，3个图片输出，1个额外的webp，1个打包的输出。
	expect(output.readdirSync("/")).toHaveLength(5);

	await expectSmallerSize(output, "icon-rss.svg");
	await expectSmallerSize(output, "test.png");
	await expectSmallerSize(output, "tantrum.gif");
});

it("should include files matches the regexp", async () => {
	const output = await runWebpack({
		entry: resolveFixture("entry-images.js"),
		output: {
			path: "/",
		},
		module: {
			rules: [
				{
					test: /\.(svg|png|jpe?g|gif|webp)(\?.*)?$/,
					loader: "file-loader",
					options: {
						name: "/[name].[ext]",
					},
				},
			],
		},
		plugins: [
			new ImageOptimizePlugin(/\.gif$/),
		],
	});

	await expectUnoptimized(output, "icon-rss.svg");
	await expectUnoptimized(output, "test.png");
	await expectSmallerSize(output, "tantrum.gif");
});

it("should generate additional webp file", async () => {
	const output = await runWebpack({
		entry: resolveFixture("entry-images.js"),
		output: {
			path: "/",
		},
		module: {
			rules: [
				{
					test: /\.(svg|png|jpe?g|gif|webp)(\?.*)?$/,
					loader: "file-loader",
					options: {
						name: "/[name].[ext]",
					},
				},
			],
		},
		plugins: [
			new ImageOptimizePlugin(),
		],
	});
	const webp = output.readFileSync("/test.webp");
	const source = await fs.stat(resolveFixture("test.png"));
	expect(webp.length).toBeLessThan(source.size);
});

/**
 * 实际使用中 ImageOptimizePlugin 还要求能够接收前面插件引入的图片，并且结果要能被后面的插件所使用。
 */
it("should cooperate with other plugins", async () => {
	const output = await runWebpack({
		entry: resolveFixture("entry-empty.js"),
		output: { path: "/" },
		plugins: [
			new CopyWebpackPlugin({
				// @ts-ignore
				patterns: [{
					from: "icon-rss.svg",
					to: "icon-rss.svg",
					context: path.join(__dirname, "fixtures"),
				}],
			}),
			new ImageOptimizePlugin(),
			new CompressionPlugin({ test: /\.svg$/ }),
		],
	});

	const files = output.readdirSync("/");
	expect(files.sort()).toEqual(["main.js", "icon-rss.svg", "icon-rss.svg.gz"].sort());

	const svg = output.readFileSync("/icon-rss.svg");
	const source = await fs.stat(resolveFixture("icon-rss.svg"));
	expect(svg.length).toBeLessThan(source.size);
});
