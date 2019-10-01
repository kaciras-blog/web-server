import MiniCssExtractPlugin from "mini-css-extract-plugin";
import { RuleSetRule, RuleSetUseItem } from "webpack";

interface LoaderChainOptions {
	production: boolean;
	extract: boolean;
	sourceMap: boolean;
}

/**
 * 生成各种样式表语言的加载器，同时包含了对 postcss、CSS Modules 的支持。
 *
 * 主要参考了 Vue-Cli-Service 的实现，生成的加载器链分为三层：
 * 1）针对不同预处理器语言的加载器，使用 test 属性来判断，选择合适的顶层加载器配置
 * 2）顶层加载器配置使用 oneOf 根据一些标识来选择加载器链,
 *    例如对 *.module.* 文件、Vue 中的<style module>，使用带有开启了 CSS Modules 的 css-loader 的加载器链。
 * 3）每个加载器链的顶层是预处理器的加载器（如果有），然后是 postcss-loader、css-loader，最后根据情况选择
 *    vue-style-loader 提供内联和热重载，或是 MiniCssExtractPlugin.loader 输出到文件。
 *
 * @param options 生成选项
 */
export default function generateCssLoaders(options: LoaderChainOptions): RuleSetRule[] {

	/**
	 * 第三层，生成加载器链
	 *
	 * 【实现】如果放在 createLoaderConfig 里面就不需要 preProcessor 传参，但我不想嵌套太多层
	 *
	 * @param modules 是否开启 CSS Modules
	 * @param preProcessor 预处理语言的加载器
	 */
	function createBaseLoaders(modules: boolean, preProcessor?: RuleSetUseItem) {
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
						: "[name]_[local]_[hash:base64:5]",
				},
			},
		};

		const postCssLoader = {
			loader: "postcss-loader",
			options: {
				sourceMap: options.sourceMap,
			},
		};

		const loaderChain: RuleSetUseItem[] = [
			outputLoader,
			cssLoader,
			postCssLoader,
		];
		if (preProcessor) {
			loaderChain.push(preProcessor);
		}
		return loaderChain;
	}

	/**
	 * 第二层，使用 resourceQuery 根据一些标识来选择加载器链
	 *
	 * @param test 匹配文件的正则表达式
	 * @param preProcessor 预处理语言的加载器
	 */
	function createLoaderConfig(test: RegExp, preProcessor?: RuleSetUseItem) {
		const selectors = [
			{
				resourceQuery: /\.module\.\w+$/,
				use: createBaseLoaders(true, preProcessor),
			},
			{
				resourceQuery: /module/,
				use: createBaseLoaders(true, preProcessor),
			},
			{
				use: createBaseLoaders(false, preProcessor),
			},
		];
		return { test, oneOf: selectors };
	}

	// 第一层，针对不同的预处理器的文件，选择加载器配置
	return [
		createLoaderConfig(/\.css$/),
		createLoaderConfig(/\.p(ost)?css$/),
		createLoaderConfig(/\.styl(us)?$/, {
			loader: "stylus-loader",
			options: {
				preferPathResolver: "webpack",
			},
		}),
		createLoaderConfig(/\.scss$/, "sass-loader"),
		createLoaderConfig(/\.sass$/, "sass-loader"),
		createLoaderConfig(/\.less$/, "less-loader"),
	];
}
