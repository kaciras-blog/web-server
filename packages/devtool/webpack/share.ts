import path from "path";
import MiniCssExtractPlugin from "mini-css-extract-plugin";
import { RuleSetUseItem } from "webpack";
import { WebpackOptions } from "../index";

/**
 * 将相对于项目目录的路径转换为绝对路径。
 *
 * @param relativePath 相对路径
 * @return 绝对路径
 */
export const resolve = (relativePath: string) => path.join(process.cwd(), relativePath);

interface CssLoadersMap {
	[name: string]: RuleSetUseItem[];
}

function cssLoaders(options: WebpackOptions, isServer: boolean, modules: boolean): CssLoadersMap {
	const sourceMap = isServer
		? options.server.cssSourceMap
		: options.client.cssSourceMap;

	const cssLoader = {
		loader: "css-loader",
		options: {
			sourceMap,
			modules: modules && {
				localIdentName: options.mode === "production"
					? "[hash:base64:8]"
					: "[local]_[hash:base64:8]",
			},
		},
	};

	// generate loader string to be used with extract text plugin
	function generateLoaders(loader?: string, loaderOptions?: any) {
		const loaders: RuleSetUseItem[] = [cssLoader, { loader: "postcss-loader" }];

		if (loader) {
			loaders.push({
				loader: loader + "-loader",
				options: Object.assign({}, loaderOptions, { sourceMap }),
			});
		}

		/*
		 * 服务端构建也要使用 vue-style-loader，照其官网所说它针对服务端渲染有额外的功能。
		 * 另外注意 MiniCssExtractPlugin 会在输出的文件里加入一个自动往 HTML > head 注入<link>的模块，这个模块
		 * 引用了 document 导致其不能在服务端使用。
		 */
		if (isServer || options.mode !== "production") {
			return (["vue-style-loader"] as RuleSetUseItem[]).concat(loaders);
		} else {
			return ([MiniCssExtractPlugin.loader] as RuleSetUseItem[]).concat(loaders);
		}
	}

	return {
		css: generateLoaders(),
		less: generateLoaders("less"),
	};
}

/**
 * 自动创建各种格式的CSS模块加载器链。
 *
 * @param options 选项
 * @param isServer 是否服务端构建
 */
export function styleLoaders(options: WebpackOptions, isServer = false) {
	const loaders = cssLoaders(options, isServer, false);
	const modular = cssLoaders(options, isServer, true);

	return Object.keys(loaders).map((ext) => ({
		test: new RegExp("\\." + ext + "$"),
		oneOf: [
			{ resourceQuery: /module/, use: modular[ext] },
			{ use: loaders[ext] },
		],
	}));
}