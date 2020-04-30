import MiniCssExtractPlugin from "mini-css-extract-plugin";
import { RuleSetRule, RuleSetUseItem } from "webpack";

interface LoaderChainOptions {

	/**
	 * 是否以生产模式构建，该模式下会执行一些优化措施。
	 */
	production: boolean;

	/**
	 * 是否将生成的样式表输出到文件。
	 */
	extract: boolean;

	/**
	 * 是否生成 SourceMap，其对开发调试时有帮助，但会增加构建时间。
	 */
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
 * @see https://github.com/vuejs/vue-cli/blob/dev/packages/%40vue/cli-service/lib/config/css.js
 * @param options 生成选项
 * @return 加载器列表
 */
export default function generateCssLoaders(options: LoaderChainOptions): RuleSetRule[] {

	/**
	 * 第三层，生成加载器链。
	 *
	 * 【实现】
	 * 如果放在 createLoaderConfig 里面就不需要 preProcessor 传参，但我不想嵌套太多层
	 *
	 * @param modules 是否开启 CSS Modules
	 * @param preProcessor 预处理语言的加载器
	 */
	function createBaseLoaders(modules: boolean, preProcessor?: RuleSetUseItem) {
		const { sourceMap } = options;

		const outputLoader = options.extract
			? MiniCssExtractPlugin.loader
			: { loader: "vue-style-loader", options: { sourceMap } };

		const cssLoader = {
			loader: "css-loader",
			options: {
				// importLoaders指定了用CSS的 @import 语法导入文件时需要用 css-loader 前面的几个加载器处理。
				// 在 css-loader 之前的有 postcss-loader 和一个可选的预处理器。
				importLoaders: 1,
				sourceMap,
				modules: modules && {
					localIdentName: options.production
						? "[hash:base64:5]"
						: "[name]_[local]_[hash:base64:5]",
				},
			},
		};

		const postcssLoader: any = {
			loader: "postcss-loader",
			options: { sourceMap },
		};
		if (options.production) {
			postcssLoader.options.plugins = [require("cssnano")()];
		}

		const loaderChain: RuleSetUseItem[] = [
			outputLoader,
			cssLoader,
			postcssLoader,
		];
		if (preProcessor) {
			loaderChain.push(preProcessor);
			cssLoader.options.importLoaders += 1;
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

	// 第一层，针对不同格式的文件，选择合适的加载器配置
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
