import { styleLoaders } from "./utils";
import { DefinePlugin } from "webpack";
import VueSSRServerPlugin from "vue-server-renderer/server-plugin"
import baseConfig from "./base.config";
import merge from "webpack-merge";
import nodeExternals from "webpack-node-externals";


export default (options: any) => {
	options = Object.assign({}, options, options.server);

	return merge(baseConfig(options, "server"), {
		entry: "./src/entry-server.js",
		target: "node",
		devtool: "source-map", // SourceMap 也会打包进bundle里
		output: {
			filename: "server-bundle.js",
			libraryTarget: "commonjs2",
		},

		module: {
			rules: styleLoaders({ ...options, extract: false }),
		},

		// 外置化应用程序依赖模块，可以使服务器构建速度更快，并生成较小的 bundle 文件。
		externals: nodeExternals({
			whitelist: [/\.css$/, /\?vue&type=style/, /\.less$/, /\.vue$/, /kx-ui/],
		}),

		plugins: [
			new DefinePlugin({ "process.env.VUE_ENV": "'server'" }),
			new VueSSRServerPlugin(), // 将输出打包成单个 JSON 文件，默认文件名`vue-ssr-server-bundle.json`
		],
	});
};
