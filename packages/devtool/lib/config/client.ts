import path from "path";
import { Configuration, DefinePlugin, RuleSetRule } from "webpack";
import { merge } from "webpack-merge";
import MiniCssExtractPlugin from "mini-css-extract-plugin";
import HtmlPlugin from "html-webpack-plugin";
import CopyPlugin from "copy-webpack-plugin";
import { InjectManifest } from "workbox-webpack-plugin";
import CompressionPlugin from "compression-webpack-plugin";
import baseConfig, { resolve } from "./base";
import generateCssLoaders from "./css";
import { DevelopmentOptions } from "../options";
import ImageOptimizePlugin from "../webpack/ImageOptimizePlugin";
import { WebpackManifestPlugin } from "webpack-manifest-plugin";

function setupBabel(config: any, options: DevelopmentOptions) {
	const loaders: RuleSetRule[] = [{
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
		new WebpackManifestPlugin({ fileName: "ssr-manifest.json" }),

		new CopyPlugin({
			patterns: [{
				from: "./public",
				to: ".",
				globOptions: {
					dot: true,
					ignore: ["./**/index.html"],
				},
			}],
		}),
		/*
		 * workbox-webpack-plugin 包含两个插件，都可用于构建 ServiceWorker：
		 * 1）GenerateSW 替你做所有的事情，自动生成代码并缓存资源，但这样一来无法定制。
		 * 2）InjectManifest 使用指定的源文件，只帮你注入资源信息和构建，定制程度更高。
		 *
		 * https://developers.google.com/web/tools/workbox/modules/workbox-webpack-plugin
		 */
		new InjectManifest({
			swSrc: "./src/service-worker/server/index",
			swDest: "sw.js",
			include: [assetsPath("**/*")],
			exclude: ["**/.*", "**/*.{map,woff,eot,ttf}"],
		}),
		new MiniCssExtractPlugin({
			filename: assetsPath("css/[name].[contenthash:5].css"),
		}),
		new DefinePlugin({ "process.env.API_ORIGIN": JSON.stringify(options.contentServer.publicOrigin) }),
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

	plugins.push(new HtmlPlugin({
		title: "Kaciras的博客",
		template: "public/index.html",
		filename: "app-shell.html",
		inject: "head",
		scriptLoading: "defer",
		minify: htmlMinifyOptions,
	}));

	// 服务端渲染的入口，要把 chunks 全部去掉以便渲染器注入资源
	plugins.push(new HtmlPlugin({
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

		// 默认文件名不带 hash，生产模式带上以便区分不同版本的文件
		config.output = {
			filename: assetsPath("js/[name].[contenthash:5].js"),
			chunkFilename: assetsPath("js/[name].[contenthash:5].js"),
		};

		// 该插件必须放在 CopyPlugin 后面才能处理由其复制的图片
		plugins.push(new ImageOptimizePlugin(new RegExp("static/")));

		const compressSource = {
			test: /\.(js|css|html|svg)$/,
			threshold: 1024,
		};
		plugins.push(new CompressionPlugin({
			...compressSource,
			algorithm: "brotliCompress",
			filename: "[path][base].br",
		}));
		plugins.push(new CompressionPlugin(compressSource));
	}

	return merge(baseConfig(options, "client"), config);
}
