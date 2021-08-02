import { resolveFixture, runWebpack } from "./test-utils";
import generateCssLoaders from "../lib/config/css";
import MiniCssExtractPlugin from "mini-css-extract-plugin";
import path from "path";

it("should support css imports", async () => {
	const output = await runWebpack({
		mode: "production",
		entry: resolveFixture("style.css"),
		devtool: false,
		output: {
			path: "/",
		},
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
	});

	expect(output.readFileSync("/main.css", "utf8")).toMatchSnapshot();
});

it("should support less", async () => {
	const output = await runWebpack({
		mode: "production",
		entry: resolveFixture("less.less"),
		devtool: false,
		output: {
			path: "/",
		},
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
	});

	expect(output.readFileSync("/main.css", "utf8")).toMatchSnapshot();
});
