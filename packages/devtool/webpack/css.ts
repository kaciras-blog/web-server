import MiniCssExtractPlugin from "mini-css-extract-plugin";
import { RuleSetRule, RuleSetUseItem } from "webpack";

interface LoaderChainOptions {
	production: boolean;
	extract: boolean;
	sourceMap: boolean;
}

export default function generateCssLoaders(options: LoaderChainOptions): RuleSetRule[] {

	function createBaseLoaders(modules: boolean, dialectLoader?: RuleSetUseItem) {
		const outputLoader = options.extract
			? MiniCssExtractPlugin.loader
			: { loader: "vue-style-loader", options: { sourceMap: options.sourceMap } };

		const cssLoader = {
			loader: "css-loader",
			options: {
				sourceMap: options.sourceMap,
				modules: modules && {
					localIdentName: options.production
						? "[hash:base64:5]"
						: "[local]_[hash:base64:5]",
				},
			},
		};

		const postCssLoader = {
			loader: "postcss-loader",
			options: {
				sourceMap: options.sourceMap,
			},
		};

		const baseLoaderChain: RuleSetUseItem[] = [
			outputLoader,
			cssLoader,
			postCssLoader,
		];
		if (dialectLoader) {
			baseLoaderChain.push(dialectLoader);
		}
		return baseLoaderChain;
	}

	function createLoaderChain(test: RegExp, dialectLoader?: RuleSetUseItem) {
		const selectors = [
			{
				resourceQuery: /\.module\.\w+$/,
				use: createBaseLoaders(true, dialectLoader),
			},
			{
				resourceQuery: /module/,
				use: createBaseLoaders(true, dialectLoader),
			},
			{
				use: createBaseLoaders(false, dialectLoader),
			},
		];
		return { test, oneOf: selectors };
	}

	return [
		createLoaderChain(/\.css$/),
		createLoaderChain(/\.p(ost)?css$/),
		createLoaderChain(/\.scss$/, "sass-loader"),
		createLoaderChain(/\.sass$/, "sass-loader"),
		createLoaderChain(/\.less$/, "less-loader"),
		createLoaderChain(/\.styl(us)?$/, "stylus-loader"),
	];
}
