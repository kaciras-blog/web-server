import CaseSensitivePathsPlugin from "case-sensitive-paths-webpack-plugin";
import path from "path";
import { VueLoaderPlugin } from "vue-loader";
import { Configuration, DefinePlugin } from "webpack";
import { DevelopmentOptions } from "../options";

/**
 * 将相对于 process.cwd 的路径转换为绝对路径。
 *
 * @param relativePath 相对路径
 * @return 对应的绝对路径
 */
export function resolve(relativePath: string) {
	return path.join(process.cwd(), relativePath);
}

function getBaseEnvironment(options: DevelopmentOptions) {
	const variables = {
		...options.thirdParty,
		TIMEOUT: options.app.requestTimeout,
	};

	const baseEnvironment: { [key: string]: any } = {};
	Object.entries(variables)
		.forEach(([k, v]) => baseEnvironment["process.env." + k] = JSON.stringify(v));

	return baseEnvironment;
}

export default function (options: DevelopmentOptions, side: "client" | "server"): Configuration {
	const webpackOpts = options.webpack;

	// 这里的 path 一定要用 posix，以便与URL中的斜杠一致
	const assetsPath = (path_: string) => path.posix.join(options.assetsDir, path_);

	return {
		mode: webpackOpts.mode,
		context: process.cwd(),
		output: {
			filename: assetsPath("js/[name].js"),
			path: options.outputDir,
			publicPath: webpackOpts.publicPath,
		},
		resolve: {
			extensions: [
				".ts", ".tsx",		// TypeScript
				".mjs",				// ES Module JavaScript
				".js", ".jsx",		// JavaScript
				".vue", ".json",	// Others
			],
			alias: {
				"vue$": "vue/dist/vue.runtime.esm.js",
				"@": resolve("src"),
				"@assets": resolve("src/assets"),
			},

			/*
			 * 在开发本项目以及用 npm link 方式的安装中，被链接项目的依赖不会被安装。
			 * 而 webpack 默认只从工作目录的 node_modules 里查找模块和加载器，导致其无法找到
			 * 在本项目里安装的的加载器。
			 *
			 * 这里把本项目的 node_modules 也加入到查找列表中来解决此问题。
			 * 在正常的（非链接方式）安装中不存在此问题，所以使用 LINK_INSTALL 变量做个开关。
			 */
			modules: [
				"node_modules",
				path.join(__dirname, "../../../../node_modules"),
			],
			symlinks: false,
		},
		resolveLoader: {
			modules: [
				"node_modules",
				path.join(__dirname, "../../../../node_modules"),
			],
		},
		module: {
			rules: [
				{
					test: /\.tsx?$/,
					use: {
						loader: "ts-loader",
						options: {
							transpileOnly: true, // 能加快编译速度
							appendTsSuffixTo: ["\\.vue$"], // vue文件里使用TS必须得加上
						},
					},
				},
				{
					test: /\.vue$/,
					loader: "vue-loader",
				},

				// 下面几个以及 CSS 的加载器需要设置 esModule: false
				// 因为 vue-loader 的 transformAssetUrls 会把资源转换为 require 调用
				{
					test: /\.(ogg|mp3|flac|aac)(\?.*)?$/,
					type: "asset/resource",
					generator: {
						filename: assetsPath("media/[name].[hash][ext]"),
					},
				},
				{
					test: /\.(woff2?|eot|ttf|otf)(\?.*)?$/,
					type: "asset/resource",
					generator: {
						filename: assetsPath("fonts/[name].[hash][ext]"),
					},
				},
				{
					test: /\.(png|jpe?g|gif|webp)(\?.*)?$/,
					type: "asset/resource",
					loader: require.resolve("../webpack/crop-image-loader"),
					generator: {
						filename: assetsPath("img/[name].[hash][ext]"),
					},
				},
				{
					test: /\.(svg)(\?.*)?$/,
					type: "asset/resource",
					generator: {
						filename: assetsPath("img/[name].[hash][ext]"),
					},
				},
			],
		},
		plugins: [
			new DefinePlugin(getBaseEnvironment(options)),
			new VueLoaderPlugin(),
			new CaseSensitivePathsPlugin({ useBeforeEmitHook: true }),
		],
		optimization: {
			noEmitOnErrors: true,
		},
		// 不提示资源过大等没啥用的信息
		performance: false,
	};
}
