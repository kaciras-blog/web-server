import CaseSensitivePathsPlugin from "case-sensitive-paths-webpack-plugin";
import hash from "hash-sum";
import path from "path";
import { VueLoaderPlugin } from "vue-loader";
import { Configuration, DefinePlugin, RuleSetRule, RuleSetUseItem } from "webpack";
import { CliDevelopmentOptions, WebpackOptions } from "..";
import { resolve } from "./share";
import ExternalWebpPlugin from "./ExternalWebpPlugin";
import CompressionPlugin from "compression-webpack-plugin";

/**
 * 生成一个标识字符串，当 cache-loader 使用默认的读写选项时，这个字符串将
 * 参与缓存 hash 值的计算，以便在源码没变而构建配置变了后更新缓存。
 *
 * @param options 选项
 */
const vueCacheIdenifier = (options: WebpackOptions) => {
	const varibles = {
		"cache-loader": require("cache-loader/package.json").version,
		"vue-loader": require("vue-loader/package.json").version,
		"vue-template-compiler": require("vue-template-compiler/package.json").version,
		"mode": options.mode,
	};
	return hash(varibles);
};


export default (options: CliDevelopmentOptions, side: "client" | "server"): Configuration => {
	const webpackOpts = options.webpack;

	// 这里的 path 一定要用 posix，以便与URL中的斜杠一致
	const assetsPath = (path_: string) => path.posix.join(options.assetsDir, path_);

	const configuraion: Configuration = {
		mode: webpackOpts.mode,
		context: process.cwd(),
		output: {
			filename: assetsPath("js/[name].js"),
			path: options.outputDir,
			publicPath: webpackOpts.publicPath,
		},
		resolve: {
			extensions: [
				".js", ".jsx",		// JavaScript
				".wasm",			// WebAssenbly
				".mjs",				// ES Module JavaScript
				".ts", ".tsx",		// TypeScript
				".vue", ".json",	// Others
			],
			alias: {
				"vue$": "vue/dist/vue.runtime.esm.js",
				"@": resolve("src"),
			},
			modules: [
				"node_modules",
				path.join(__dirname, "../../../node_modules"),
			],
			symlinks: false,
		},
		resolveLoader: {
			modules: [
				"node_modules",
				path.join(__dirname, "../../../node_modules"),
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
						cacheIdentifier: vueCacheIdenifier(webpackOpts),
					},
				},
				{
					test: /\.(mp4|webm|ogg|mp3|wav|flac|aac)(\?.*)?$/,
					loader: "url-loader",
					options: {
						limit: 10000,
						name: assetsPath("media/[name].[hash:8].[ext]"),
					},
				},
				{
					test: /\.(woff2?|eot|ttf|otf)(\?.*)?$/,
					loader: "url-loader",
					options: {
						limit: 10000,
						name: assetsPath("fonts/[name].[hash:8].[ext]"),
					},
				},
			],
		},
		plugins: [
			new DefinePlugin({
				"process.env.CONFIG": JSON.stringify(options.envConfig),
			}),
			new VueLoaderPlugin(),
			new CaseSensitivePathsPlugin(),
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
		performance: false, // 不提示资源过大等没啥用的信息
	};

	const imageLoaders: RuleSetRule[] = [
		{
			test: /\.(png|jpe?g|gif|webp)(\?.*)?$/,
			use: [
				{
					loader: "url-loader",
					options: {
						limit: 2048,
						name: assetsPath("img/[name].[hash:8].[ext]"),
					},
				},
			],
		},
		{
			test: /\.(svg)(\?.*)?$/,
			use: [
				{
					loader: "file-loader",
					options: {
						name: assetsPath("img/[name].[hash:8].[ext]"),
					},
				},
			],
		},
	];

	if (options.webpack.mode === "production" && side === "client") {
		configuraion.plugins!.push(new CompressionPlugin({
			test: /\.(js|css|html|svg)$/,
			threshold: 1024,
		}));
		// @ts-ignore 用别人的库就是这么坑爹，类型定义跟不上版本
		configuraion.plugins!.push(new CompressionPlugin({
			filename: "[path].br[query]",
			test: /\.(js|css|html|svg)$/,
			threshold: 1024,
			algorithm: "brotliCompress",
		}));
		configuraion.plugins!.push(new ExternalWebpPlugin());
		imageLoaders.forEach((loader) => (loader.use as RuleSetUseItem[]).push("image-webpack-loader"));
	}
	configuraion.module!.rules.push(...imageLoaders);

	return configuraion;
};
