import path from "path";
import { Configuration, HashedModuleIdsPlugin, RuleSetLoader } from "webpack";
import merge from "webpack-merge";
import MiniCssExtractPlugin from "mini-css-extract-plugin";
import HtmlWebpackPlugin from "html-webpack-plugin";
import CopyWebpackPlugin from "copy-webpack-plugin";
import OptimizeCSSPlugin from "optimize-css-assets-webpack-plugin";
import VueSSRClientPlugin from "vue-server-renderer/client-plugin";
import CompressionPlugin from "compression-webpack-plugin";
import baseWebpackConfig, { resolve } from "./base";
import generateCssLoaders from "./css";
import { DevelopmentOptions } from "../options";
import ImageOptimizePlugin from "../webpack/ImageOptimizePlugin";

// 这个没有类型定义
const ServiceWorkerWebpackPlugin = require("serviceworker-webpack-plugin");

interface ServiceWorkerOption {
	assets: string[];
}

function setupBabel(config: any, options: DevelopmentOptions) {
	const loaders: RuleSetLoader[] = [{
		loader: "babel-loader",
		options: {
			cacheDirectory: true,
			cacheCompression: false,
		},
	}];

	if (options.webpack.parallel) {
		loaders.unshift({ loader: "thread-loader" });
	}

	if (!config.module) {
		config.module = { rules: [] };
	}

	// 【坑】webpack-hot-client 不能放进来，否则报错 module.exports is read-only
	config.module.rules.push({
		test: /\.(mjs|jsx?)$/,
		use: loaders,
		include: [
			resolve("node_modules/@kaciras-blog/uikit/src"),
			resolve("src"),
			resolve("test"),
			/node_modules\/webpack-hot-middleware\/client/,
		],
		exclude: [
			resolve("src/service-worker"),
		],
	});
}

export default function (options: DevelopmentOptions) {
	const webpackOpts = options.webpack;

	const assetsPath = (path_: string) => path.posix.join(options.assetsDir, path_);

	const plugins = [
		new CopyWebpackPlugin({
			patterns: [{
				from: "./public",
				to: ".",
				globOptions: {
					dot: true,
					ignore: ["./**/index.html"],
				},
			}],
		}),
		new ServiceWorkerWebpackPlugin({
			entry: "./src/service-worker/index",

			// 支持ServiceWorker的浏览器也支持woff2，其他字体就不需要了
			excludes: ["**/.*", "**/*.{map,woff,eot,ttf}"],
			includes: [assetsPath("**/*")],

			// 图片就不预载了，浪费流量。
			// 这个傻B插件都不晓得把路径分隔符转换下。
			transformOptions(data: ServiceWorkerOption) {
				let { assets } = data;
				assets = assets.filter(name => !name.startsWith("/static/img/") && !/KaTeX/.test(name));
				assets = assets.map(name => name.replace(/\\/g, "/"));
				return { assets };
			},
		}),
		new MiniCssExtractPlugin({
			filename: assetsPath("css/[name].[contenthash:8].css"),
		}),
		new OptimizeCSSPlugin({
			cssProcessorOptions: { map: { inline: false } },
		}),
		new VueSSRClientPlugin(),
		new HashedModuleIdsPlugin(),
	];

	const htmlMinifyOptions = {
		removeScriptTypeAttributes: true,
		collapseWhitespace: true,
		removeComments: true,
		removeRedundantAttributes: true,
		removeStyleLinkTypeAttributes: true,
		useShortDoctype: true,
		removeAttributeQuotes: true,
	};

	plugins.push(new HtmlWebpackPlugin({
		title: "Kaciras的博客",
		template: "public/index.html",
		filename: "app-shell.html",
		inject: "head",
		scriptLoading: "defer",
		minify: htmlMinifyOptions,
	}));

	// 服务端渲染的入口，要把 chunks 全部去掉以便渲染器注入资源
	plugins.push(new HtmlWebpackPlugin({
		chunks: [],
		template: "public/index.template.html",
		filename: "index.template.html",
		minify: { ...htmlMinifyOptions, removeComments: false },
	}));

	const config: Configuration = {
		entry: ["./src/entry-client"],
		devtool: webpackOpts.client.devtool,
		plugins,
		optimization: {
			splitChunks: {
				cacheGroups: {
					vendor: {
						name: "vendors",
						test: /[\\/]node_modules[\\/]/,
						priority: -10,
						chunks: "initial",
					},
					async: {
						name: "async",
						chunks: "async",
						priority: -20,
						minChunks: 2,
						reuseExistingChunk: true, // ?
					},
				},
			},
			runtimeChunk: {
				name: "manifest",
			},
		},
		module: {
			rules: generateCssLoaders({
				production: webpackOpts.mode === "production",
				extract: webpackOpts.mode === "production",
				sourceMap: webpackOpts.client.cssSourceMap,
			}),
		},
	};

	if (webpackOpts.client.useBabel) {
		setupBabel(config, options);
	}

	if (webpackOpts.bundleAnalyzerReport) {
		const BundleAnalyzerPlugin = require("webpack-bundle-analyzer").BundleAnalyzerPlugin;
		plugins.push(new BundleAnalyzerPlugin());
	}

	if (webpackOpts.mode === "production") {

		// 默认文件名不带hash，生产模式带上以便区分不同版本的文件
		config.output = {
			filename: assetsPath("js/[name].[contenthash].js"),
			chunkFilename: assetsPath("js/[name].[contenthash].js"),
		};

		// 该插件必须放在 CopyWebpackPlugin 后面才能处理由其复制的图片
		plugins.push(new ImageOptimizePlugin(new RegExp("static/")));

		const compressSource = {
			test: /\.(js|css|html|svg)$/,
			threshold: 1024,
		};
		plugins.push(new CompressionPlugin({
			...compressSource,
			algorithm: "brotliCompress",
			filename: "[path].br[query]",
		}));
		plugins.push(new CompressionPlugin(compressSource));
	}

	return merge(baseWebpackConfig(options, "client"), config);
}
