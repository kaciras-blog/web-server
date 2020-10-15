import CaseSensitivePathsPlugin from "case-sensitive-paths-webpack-plugin";
import hash from "hash-sum";
import path from "path";
import { VueLoaderPlugin } from "vue-loader";
import { Configuration, DefinePlugin } from "webpack";
import { DevelopmentOptions, WebpackOptions } from "../options";
import CodeValueObject = DefinePlugin.CodeValueObject;

/**
 * 将相对于 process.cwd 的路径转换为绝对路径。
 *
 * @param relativePath 相对路径
 * @return 对应的绝对路径
 */
export function resolve(relativePath: string) {
	return path.join(process.cwd(), relativePath);
}

/**
 * 生成一个标识字符串，当 cache-loader 使用默认的读写选项时，这个字符串将
 * 参与缓存 hash 值的计算，以便在源码没变而构建配置变了后更新缓存。
 *
 * @param options 选项
 */
const vieCacheIdentifier = (options: WebpackOptions) => {
	const variables = {
		"cache-loader": require("cache-loader/package.json").version,
		"vue-loader": require("vue-loader/package.json").version,
		"vue-template-compiler": require("vue-template-compiler/package.json").version,
		"mode": options.mode,
	};
	return hash(variables);
};

function getBaseEnvironment(options: DevelopmentOptions) {
	const variables = {
		...options.thirdParty,
		TIMEOUT: options.app.requestTimeout,
	}

	const baseEnvironment: { [key: string]: CodeValueObject } = {};
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
				".wasm",			// WebAssembly
				".mjs",				// ES Module JavaScript
				".js", ".jsx",		// JavaScript
				".vue", ".json",	// Others
			],
			alias: {
				"vue$": "vue/dist/vue.runtime.esm.js",
				"@": resolve("src"),
				"@assets":  resolve("src/assets"),
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
					options: {
						...webpackOpts.vueLoader,
						cacheDirectory: resolve("node_modules/.cache/vue-loader-" + side),
						cacheIdentifier: vieCacheIdentifier(webpackOpts),
					},
				},

				// 下面几个加载器需要设置 esModule: false，因为引用方有使用 CJS require 加载的
				{
					test: /\.(mp4|webm|ogg|mp3|wav|flac|aac)(\?.*)?$/,
					loader: "url-loader",
					options: {
						esModule: false,
						limit: 10000,
						name: assetsPath("media/[name].[hash:5].[ext]"),
					},
				},
				{
					test: /\.(woff2?|eot|ttf|otf)(\?.*)?$/,
					loader: "url-loader",
					options: {
						esModule: false,
						limit: 10000,
						name: assetsPath("fonts/[name].[hash:5].[ext]"),
					},
				},
				{
					test: /\.(png|jpe?g|gif|webp)(\?.*)?$/,
					use: [
						{
							loader: "url-loader",
							options: {
								esModule: false,
								limit: 2048,
								name: assetsPath("img/[name].[hash:5].[ext]"),
							},
						},
						{
							loader: require.resolve("../webpack/crop-image-loader"),
						},
					],
				},
				{
					test: /\.(svg)(\?.*)?$/,
					use: [
						{
							loader: "file-loader",
							options: {
								esModule: false,
								name: assetsPath("img/[name].[hash:5].[ext]"),
							},
						},
					],
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
		node: {
			setImmediate: false,

			// [Vue-Cli] process is injected via DefinePlugin, although some
			// 3rd party libraries may require a mock to work properly (#934)
			process: "mock",

			dgram: "empty",
			fs: "empty",
			net: "empty",
			tls: "empty",
			child_process: "empty",
		},

		// 不提示资源过大等没啥用的信息
		performance: false,
	};
}
