import { promisify } from "util";
import chalk from "chalk";
import fs from "fs-extra";
import webpack, { Configuration, Stats } from "webpack";
import { configureGlobalAxios } from "@kaciras-blog/server/lib/helpers";
import Launcher from "@kaciras-blog/server/lib/Launcher";
import { runServer } from "@kaciras-blog/server/lib/create-server";
import getBlogPlugin from "@kaciras-blog/server/lib/blog-plugin";
import ApplicationBuilder from "@kaciras-blog/server/lib/ApplicationBuilder";
import { ClosableMiddleware, createHotMiddleware, createKoaWebpack } from "./dev-middleware";
import VueSSRHotReloader from "./ssr-hot-reload";
import ClientConfiguration from "./config/client";
import ServerConfiguration from "./config/server";
import { DevelopmentOptions } from "./options";

// 没有类型定义
const SpeedMeasurePlugin = require("speed-measure-webpack-plugin");

const launcher = new Launcher<DevelopmentOptions>();

/**
 * 调用 webpack，并输出更友好的信息。
 *
 * @param config webpack的配置
 */
async function invokeWebpack(config: Configuration) {
	const stats = await promisify<Configuration, Stats>(webpack)(config);

	console.log(stats.toString("errors-warnings"));

	if (stats.hasErrors()) {
		console.log(chalk.red("Build failed with errors.\n"));
		process.exit(1);
	}
}

/**
 * 启动开发服务器，它提供了热重载功能。
 */
launcher.registerCommand("serve", async (options: DevelopmentOptions) => {
	const closeHttp2Sessions = await configureGlobalAxios(options.blog.serverAddress, options.blog.serverCert);

	const api = new ApplicationBuilder();
	api.addPlugin(getBlogPlugin(options.blog));

	const clientConfig = ClientConfiguration(options);
	const vueSSRHotReloader = VueSSRHotReloader.create(clientConfig, options);

	let devMiddleware: ClosableMiddleware;
	if (options.dev.useHotClient !== false) {
		devMiddleware = await createKoaWebpack(clientConfig);
	} else {
		devMiddleware = await createHotMiddleware(clientConfig);
	}
	api.useBeforeFilter(devMiddleware);

	await vueSSRHotReloader.watch();
	api.useFallBack(vueSSRHotReloader.koaMiddleware);

	const closeServer = await runServer(api.build().callback(), options.server);
	console.info(`\n- Local URL: https://localhost/\n`);

	return () => {
		closeHttp2Sessions();
		closeServer();
		devMiddleware.close();
		vueSSRHotReloader.close();
	}
});

launcher.registerCommand("build", async (options: DevelopmentOptions) => {
	await fs.remove(options.outputDir);

	let clientConfig = ClientConfiguration(options)

	if (options.webpack.speedMeasure) {
		const smp = new SpeedMeasurePlugin();
		clientConfig = smp.wrap(clientConfig);
	}

	await invokeWebpack(clientConfig);
	await invokeWebpack(ServerConfiguration(options));

	console.log(chalk.cyan("Build complete."));
});

export default launcher;
