import VueSSRServerPlugin from "vue-server-renderer/server-plugin";
import { DefinePlugin } from "webpack";
import { merge } from "webpack-merge";
import nodeExternals from "webpack-node-externals";
import baseConfig from "./base";
import { DevelopmentOptions } from "../options";
import generateCssLoaders from "./css";

export default function (options: DevelopmentOptions) {

	return merge(baseConfig(options, "server"), {
		entry: ["./src/entry-server"],
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

		// 外置化应用程序依赖模块，可以使服务器构建速度更快，并生成较小的 bundle 文件。
		// 被排除的依赖要求在运行时由服务器提供，需要单独安装。
		// whitelist 中的文件将不会被排除，包括样式表、vue文件以及需要构建的第三方库。
		externals: nodeExternals({
			allowlist: [/\.css$/, /\?vue&type=style/, /\.less$/, /\.vue$/, /@kaciras-blog\/uikit/],
		}),

		plugins: [
			// TODO: https://github.com/vuejs/vue/issues/11718
			new VueSSRServerPlugin(),
			new DefinePlugin({
				"process.env.API_ORIGIN": JSON.stringify(options.contentServer.internalOrigin),
				"process.env.VUE_ENV": "'server'",
			}),
		],
	});
}
