import { promisify } from "util";
import chalk from "chalk";
import fs from "fs-extra";
import webpack, { Configuration, Stats } from "webpack";
import { configureGlobalAxios } from "@kaciras-blog/server/lib/helpers";
import Launcher from "@kaciras-blog/server/lib/Launcher";
import startServer from "@kaciras-blog/server/lib/create-server";
import getBlogPlugin from "@kaciras-blog/server/lib/blog-plugin";
import ApplicationBuilder from "@kaciras-blog/server/lib/ApplicationBuilder";
import { ClosableMiddleware, createHotMiddleware, createKoaWebpack } from "./dev-middleware";
import VueSSRHotReloader, { ClientSSRHotUpdatePlugin } from "./ssr-hot-reload";
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
	const closeHttp2Sessions = await configureGlobalAxios(options.contentServer);

	const builder = new ApplicationBuilder();
	builder.addPlugin(getBlogPlugin(options));

	const clientConfig = ClientConfiguration(options);
	clientConfig.plugins!.push(new ClientSSRHotUpdatePlugin())

	let devMiddleware: ClosableMiddleware;
	if (options.dev.useHotClient !== false) {
		devMiddleware = await createKoaWebpack(clientConfig);
	} else {
		devMiddleware = await createHotMiddleware(clientConfig);
	}
	builder.useBeforeFilter(devMiddleware);

	const vueSSRHotReloader = new VueSSRHotReloader(clientConfig, ServerConfiguration(options));
	await vueSSRHotReloader.watch();
	builder.useFallBack(vueSSRHotReloader.koaMiddleware);

	const app = builder.build();
	app.proxy = !!options.server.useForwardedHeaders;

	const closeServer = await startServer(app.callback(), options.server);
	console.info("\n- Local URL: https://localhost/\n");

	return () => {
		closeServer();
		vueSSRHotReloader.close();
		devMiddleware.close();
		closeHttp2Sessions();
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
