import chalk from "chalk";
import fs from "fs-extra";
import { configureApp, createServer } from "kxc-server/app";
import path from "path";
import { promisify } from "util";
import webpack, { Options, Configuration, Stats } from "webpack";
import KacirasService from "kxc-server";
import dev from "./plugins/dev";
import { configureWebpackSSR, rendererFactory } from "./plugins/vue";
import ClientConfiguration from "./template/client.config";
import ServerConfiguration from "./template/server.config";
import Koa from "koa";


/* =========================================================================== *\
								配置选项定义
\* =========================================================================== */

export interface WebpackOptions {
	mode: "development" | "production" | "none";

	outputPath: string;	// webpack的输出目录
	publicPath: string;	// 公共资源的URL前缀，可以设为外部服务器等
	assetsDirectory: string;	// 公共资源输出目录，是outputPath的子目录

	bundleAnalyzerReport: any;

	client: {
		useBabel: boolean,
		parallel: boolean, // 多线程编译JS文件
		devtool: Options.Devtool;
		cssSourceMap: boolean,
	};

	server: {
		template: string;
		devtool: Options.Devtool; // 服务端没有eval模式
		cssSourceMap: boolean,
	};

	vueLoader?: any;
}

/**
 * 调用webpack，并输出更友好的信息。
 *
 * @param config 配置
 * @return {Promise<void>} 指示构建状态
 */
async function invokeWebpack (config: Configuration) {
	const stats = await promisify<Configuration, Stats>(webpack)(config);

	process.stdout.write(stats.toString({
		colors: true,
		modules: false,
		children: true, // Setting this to true will make TypeScript errors show up during build.
		chunks: false,
		chunkModules: false,
	}) + "\n\n");

	if (stats.hasErrors()) {
		console.log(chalk.red("Build failed with errors.\n"));
		process.exit(1);
	}
}

async function runServe (config: any) {
	const app = new Koa();

	configureWebpackSSR(config.webpack);
	const devMiddleware = await dev(false, config.webpack);
	app.use(devMiddleware);

	configureApp(app, config.blog);
	const rf = rendererFactory(config.webpack);

	createServer(app.callback(), config.server);
}

const service = new KacirasService();

service.registerCommand("build", async (config) => {
	process.env.NODE_PATH = path.resolve("node_modules");
	require("module").Module._initPaths();

	await fs.remove(config.webpack.assetsDirectory);
	await invokeWebpack(ClientConfiguration(config));
	await invokeWebpack(ServerConfiguration(config));

	console.log(chalk.cyan("Build complete.\n"));
});

service.registerCommand("serve", runServe);
service.run();
