import chalk from "chalk";
import fs from "fs-extra";
import KacirasService, { CliServerAPI } from "kxc-server";
import { createServer } from "kxc-server/app";
import BlogPlugin from "kxc-server/BlogPlugin";
import ssr from "kxc-server/VueSSR";
import { promisify } from "util";
import webpack, { Configuration, Stats } from "webpack";
import dev from "../plugins/dev";
import { configureWebpackSSR, rendererFactory } from "../plugins/vue";
import ClientConfiguration from "../template/client.config";
import ServerConfiguration from "../template/server.config";


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

async function runServe (options: any) {
	const api = new CliServerAPI();

	const bp = new BlogPlugin(options.blog);
	bp.configureServer(api);

	configureWebpackSSR(options.webpack);
	const devMiddleware = await dev(false, options.webpack);

	api.useBeforeFilter(devMiddleware);
	const renderer = rendererFactory(options.webpack);

	api.useFallBack(ssr({ renderer }));
	createServer(api.createApp().callback(), options.server);
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
