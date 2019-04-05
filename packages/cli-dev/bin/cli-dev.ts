import chalk from "chalk";
import fs from "fs-extra";
import KacirasService from "kxc-server";
import { runServer } from "kxc-server/app";
import BlogPlugin from "kxc-server/BlogPlugin";
import ServerAPI from "kxc-server/ServerAPI";
import { ssrMiddleware } from "kxc-server/VueSSR";
import { promisify } from "util";
import webpack, { Configuration, Stats } from "webpack";
import CliDevelopmentOptions from "../OldOptions";
import dev from "../plugins/dev";
import VueSSRHotReloader from "../plugins/vue";
import ClientConfiguration from "../template/client.config";
import ServerConfiguration from "../template/server.config";

require("source-map-support").install();

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

async function runServe (options: CliDevelopmentOptions) {
	const api = new ServerAPI();

	const bp = new BlogPlugin(options.blog);
	bp.configureCliServer(api);

	const cc = ClientConfiguration(options.webpack);
	const ssrPlugin = new VueSSRHotReloader();
	ssrPlugin.configureWebpackSSR(cc);
	const devMiddleware = await dev(false, cc);

	api.useBeforeFilter(devMiddleware);
	const renderer = await ssrPlugin.rendererFactory(options.webpack);

	api.useFallBack(ssrMiddleware({ renderer }));
	runServer(api.createApp().callback(), options.server).then(() => {
		console.info();
		console.info(`\tLocal URL: https://localhost:${options.server.httpsPort}`);
	});
}

const service = new KacirasService<CliDevelopmentOptions>();

service.registerCommand("build", async (config) => {
	await fs.remove(config.webpack.outputPath);
	await invokeWebpack(ClientConfiguration(config.webpack));
	await invokeWebpack(ServerConfiguration(config.webpack));

	console.log(chalk.cyan("Build complete.\n"));
});

service.registerCommand("serve", runServe);
service.run();
