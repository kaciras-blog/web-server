import chalk from "chalk";
import fs from "fs-extra";
import KacirasService from "kxc-server";
import { configureApp, runServer } from "kxc-server/app";
import ssr from "kxc-server/vue-ssr";
import { promisify } from "util";
import webpack, { Configuration, Stats } from "webpack";
import dev from "../plugins/dev";
import { configureWebpackSSR, rendererFactory } from "../plugins/vue";
import ClientConfiguration from "../template/client.config";
import ServerConfiguration from "../template/server.config";
import Koa from "koa";


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

	const cc = ClientConfiguration(config.webpack);
	configureWebpackSSR(cc);
	const devMiddleware = await dev(false, cc);
	app.use(devMiddleware);

	configureApp(app, config.blog);
	const renderer = await rendererFactory(config.webpack);
	app.use(ssr({ renderer }));

	runServer(app.callback(), config.server);
}

const service = new KacirasService();

service.registerCommand("build", async (config) => {
	await fs.remove(config.webpack.outputPath);
	await invokeWebpack(ClientConfiguration(config.webpack));
	await invokeWebpack(ServerConfiguration(config.webpack));

	console.log(chalk.cyan("Build complete.\n"));
});

service.registerCommand("serve", runServe);
service.run();
