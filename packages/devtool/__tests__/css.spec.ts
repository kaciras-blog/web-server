import path from "path";
import { Configuration } from "webpack";
import MiniCssExtractPlugin from "mini-css-extract-plugin";
import MemoryFs from "memory-fs";
import { resolveFixture, runWebpack } from "./test-utils";
import generateCssLoaders from "../lib/config/css";

it("should support css imports", async () => {
	const config: Configuration = {
		mode: "production",
		entry: resolveFixture("style.css"),
		resolveLoader: {
			modules: [
				"node_modules",
				path.join(__dirname, "../node_modules"),
			],
		},
		module: {
			rules: generateCssLoaders({
				production: false,
				extract: true,
				sourceMap: false,
			}),
		},
		plugins: [
			new MiniCssExtractPlugin({ filename: "[name].css" }),
		],
	};
	const output = new MemoryFs();
	await runWebpack(config, output);

	expect(output.readFileSync("/main.css", "utf8")).toMatchSnapshot();
});

it("should support less", async () => {
	const config: Configuration = {
		mode: "production",
		entry: resolveFixture("less.less"),
		resolveLoader: {
			modules: [
				"node_modules",
				path.join(__dirname, "../node_modules"),
			],
		},
		module: {
			rules: generateCssLoaders({
				production: false,
				extract: true,
				sourceMap: false,
			}),
		},
		plugins: [
			new MiniCssExtractPlugin({ filename: "[name].css" }),
		],
	};
	const output = new MemoryFs();
	await runWebpack(config, output);

	expect(output.readFileSync("/main.css", "utf8")).toMatchSnapshot();
});
