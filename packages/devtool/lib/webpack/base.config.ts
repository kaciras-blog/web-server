import CaseSensitivePathsPlugin from "case-sensitive-paths-webpack-plugin";
import hash from "hash-sum";
import path from "path";
import { VueLoaderPlugin } from "vue-loader";
import { Configuration, DefinePlugin } from "webpack";
import { CliDevelopmentOptions, WebpackOptions } from "../options";


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

export default function (options: CliDevelopmentOptions, side: "client" | "server"): Configuration {
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
				".js", ".jsx",		// JavaScript
				".wasm",			// WebAssembly
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
						{
							loader: require.resolve("./crop-image-loader"),
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

		// 不提示资源过大等没啥用的信息
		performance: false,
	};
}
