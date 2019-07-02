import VueSSRServerPlugin from "vue-server-renderer/server-plugin";
import { DefinePlugin } from "webpack";
import merge from "webpack-merge";
import nodeExternals from "webpack-node-externals";
import baseConfig from "./base.config";
import { styleLoaders } from "./share";
import { CliDevelopmentOptions } from "../index";


export default (options: CliDevelopmentOptions) => {

	// 服务端构建时页面内的请求走内部地址
	options.envConfig.contentServerUri = options.blog.serverAddress;

	return merge(baseConfig(options, "server"), {
		entry: "./src/entry-server.js",
		target: "node",
		devtool: options.webpack.server.devtool, // SourceMap 也会打包进bundle里

		output: {
			filename: "server-bundle.js",
			libraryTarget: "commonjs2",
		},

		module: {
			rules: styleLoaders(options.webpack, true),
		},

		// 外置化应用程序依赖模块，可以使服务器构建速度更快，并生成较小的 bundle 文件。
		// 被排除的依赖要求在运行时由服务器提供，需要单独安装。
		// whitelist 中的文件将不会被排除，包括样式表、vue文件以及需要构建的第三方库。
		externals: nodeExternals({
			whitelist: [/\.css$/, /\?vue&type=style/, /\.less$/, /\.vue$/, /kx-ui/],
		}),

		plugins: [
			new DefinePlugin({ "process.env.VUE_ENV": "'server'" }),
			new VueSSRServerPlugin(), // 将输出打包成单个 JSON 文件，默认文件名`vue-ssr-server-bundle.json`
		],
	});
};
