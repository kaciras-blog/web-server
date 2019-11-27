import path from "path";
import fs from "fs-extra";
import ImageOptimizePlugin from "../lib/webpack/ImageOptimizePlugin";
import { resolveFixture, runWebpack } from "./test-utils";
import CopyWebpackPlugin from "copy-webpack-plugin";
import CompressionPlugin from "compression-webpack-plugin";

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

	async function expectSmallerSize(name: string) {
		const optimized = output.readFileSync("/" + name);
		const source = await fs.stat(resolveFixture(name));
		expect(optimized.length).toBeLessThan(source.size);
	}

	await expectSmallerSize("icon-rss.svg");
	await expectSmallerSize("test.png");
	await expectSmallerSize("tantrum.gif");
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
			new CopyWebpackPlugin([
				{
					from: "icon-rss.svg",
					to: "icon-rss.svg",
					context: path.join(__dirname, "fixtures"),
				},
			]),
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
