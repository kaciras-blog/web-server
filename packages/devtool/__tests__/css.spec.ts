import { Configuration } from "webpack";
import MiniCssExtractPlugin from "mini-css-extract-plugin";
import MemoryFs from "memory-fs";
import { resolveFixture, runWebpack } from "./test-utils";
import generateCssLoaders from "../lib/config/css";

it("should support css imports", async () => {
	const config: Configuration = {
		mode: "production",
		entry: resolveFixture("style.css"),
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
