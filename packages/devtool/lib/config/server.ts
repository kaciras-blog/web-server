import { DefinePlugin } from "webpack";
import { merge } from "webpack-merge";
import nodeExternals from "webpack-node-externals";
import { DevelopmentOptions } from "../options";
import baseConfig from "./base";
import generateCssLoaders from "./css";

export default function (options: DevelopmentOptions) {
	return merge(baseConfig(options), {
		entry: [
			"./src/entry-server",
		],
		target: "node",
		output: {
			filename: "server-bundle.js",
			libraryTarget: "commonjs2",
		},

		// SourceMap 也会打包进 bundle 里
		devtool: options.webpack.server.devtool,

		module: {
			rules: generateCssLoaders({
				production: options.webpack.mode === "production",
				extract: false,
				sourceMap: options.webpack.server.cssSourceMap,
			}),
		},
		externals: nodeExternals({
			allowlist: [
				/\.css$/,
				/\?vue&type=style/,
				/\.less$/,
				/\.vue$/,
				/@kaciras-blog\/uikit/],
		}),
		plugins: [
			new DefinePlugin({
				"process.env.API_ORIGIN": JSON.stringify(options.contentServer.internalOrigin),
				"process.env.VUE_ENV": "'server'",
			}),
		],
	});
}
