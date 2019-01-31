import path from "path";
import { Configuration, RuleSetLoader } from "webpack";
import { HashedModuleIdsPlugin } from "webpack";
import MiniCssExtractPlugin from "mini-css-extract-plugin";
import baseWebpackConfig from "./base.config";
import { resolve, styleLoaders } from "./utils";
import VueSSRClientPlugin from "vue-server-renderer/client-plugin";
import CopyWebpackPlugin from "copy-webpack-plugin";
import OptimizeCSSPlugin from "optimize-css-assets-webpack-plugin";
import merge from "webpack-merge";

// 这个没有类型定义
const ServiceWorkerWebpackPlugin = require("serviceworker-webpack-plugin");


const setupBabel = (webpackConfig: any, options: any) => {
	webpackConfig.entry.unshift("@babel/polyfill");

	const loaders: RuleSetLoader[] = [{
		loader: "babel-loader",
		options: {
			cacheDirectory: true,
			cacheCompression: false,
		},
	}];

	if (options.parallel) {
		loaders.unshift({ loader: "thread-loader" });
	}

	webpackConfig.module.rules.push({
		test: /\.(mjs|jsx?)$/,
		use: loaders,
		include: [
			resolve("node_modules/kx-ui/src"),
			resolve("node_modules/markdown-it-anchor"),
			resolve("src"),
			resolve("test"),

			resolve("node_modules/webpack-hot-middleware/client"),
			resolve("node_modules/webpack-hot-client/client"),
		],
		exclude: [
			resolve("src/service-worker"),
		],
	});
};

export default (options: any) => {
	options = Object.assign({}, options, options.client);
	const assetsPath = (path_: string) => path.posix.join(options.assetsDirectory, path_);

	const config: Configuration = {
		entry: ["./src/entry-client.js"],
		module: {
			rules: styleLoaders({ ...options, extract: true }),
		},
		devtool: options.devtool,
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
		plugins: [
			new CopyWebpackPlugin([
				{
					from: "./public",
					to: ".",
					ignore: ["index.html"],
				}],
			),
			new ServiceWorkerWebpackPlugin({
				entry: "./src/service-worker/index",
				includes: ["static/**/*"],
				excludes: ["**/.*", "**/*.map", "static/icons/*"],
			}),
			new MiniCssExtractPlugin({
				filename: assetsPath("css/[name].[hash].css"),
			}),
			new OptimizeCSSPlugin({
				cssProcessorOptions: { map: { inline: false } },
			}),
			new HashedModuleIdsPlugin(),
			new VueSSRClientPlugin(),
		],
	};

	/** 默认文件名不带hash，生产模式带上以便区分不同版本的文件 */
	if (options.mode === "production") {
		config.output = {
			filename: assetsPath("js/[name].[contenthash:8].js"),
			chunkFilename: assetsPath("js/[name].[contenthash:8].js"),
		};
	}

	if (options.useBabel) {
		setupBabel(config, options);
	}

	if (options.bundleAnalyzerReport && config.plugins /* redundant */) {
		const BundleAnalyzerPlugin = require("webpack-bundle-analyzer").BundleAnalyzerPlugin;
		config.plugins.push(new BundleAnalyzerPlugin());
	}

	return merge(baseWebpackConfig(options, "client"), config);
};
