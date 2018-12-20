import path from "path";
import MiniCssExtractPlugin from "mini-css-extract-plugin"
import { RuleSetUseItem } from "webpack";

/**
 * 获取相对于项目目录的绝对路径。
 *
 * @param dir 相对路径
 * @return 绝对路径
 */
export const resolve = (dir: string) => path.join(process.cwd(), dir);

interface CssLoadersMap {
	[name: string]: RuleSetUseItem[]
}

function cssLoaders(options: any): CssLoadersMap {
	const cssLoader = {
		loader: "css-loader",
		options: {
			sourceMap: options.cssSourceMap,
			modules: options.modules,
			localIdentName: options.mode === "production"
				? "[hash:base64:8]"
				: "[local]_[hash:base64:8]",
		},
	};

	// generate loader string to be used with extract text plugin
	function generateLoaders(loader?: string, loaderOptions?: any): RuleSetUseItem[] {
		const loaders = [cssLoader];

		if (loader) {
			loaders.push({
				loader: loader + "-loader",
				options: Object.assign({}, loaderOptions, {
					sourceMap: options.cssSourceMap,
				}),
			});
		}

		// Extract CSS when that option is specified
		// (which is the case during production build)
		if (options.extract) {
			return [MiniCssExtractPlugin.loader].concat(loaders);
		} else {
			return (<RuleSetUseItem[]>["vue-style-loader"]).concat(loaders);
		}
	}

	return {
		css: generateLoaders(),
		less: generateLoaders("less"),
	};
}

export function styleLoaders(options: any) {
	const output = [];
	const loaders = cssLoaders(options);

	// 再生成一个CSS Modules的加载器
	options.modules = true;
	const moduleLoaders = cssLoaders(options);

	for (const extension in loaders) {
		output.push({
			test: new RegExp("\\." + extension + "$"),
			oneOf: [
				{
					resourceQuery: /module/,
					use: moduleLoaders[extension],
				},
				{
					use: loaders[extension],
				},
			],
		});
	}

	return output;
}
