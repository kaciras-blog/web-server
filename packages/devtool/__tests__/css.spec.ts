import { resolveFixture, runWebpack } from "./test-utils";
import generateCssLoaders from "../lib/config/css";
import MiniCssExtractPlugin from "mini-css-extract-plugin";

it("should support css imports", async () => {
	const output = await runWebpack({
		mode: "development",
		entry: resolveFixture("style.css"),
		devtool: false,
		output: {
			path: "/",
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

it('should support less', async () => {
	const output = await runWebpack({
		mode: "development",
		entry: resolveFixture("less.less"),
		devtool: false,
		output: {
			path: "/",
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
