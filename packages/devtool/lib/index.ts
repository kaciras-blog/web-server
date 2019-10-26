import { promisify } from "util";
import chalk from "chalk";
import fs from "fs-extra";
import webpack, { Configuration, Stats } from "webpack";
import { configureGlobalAxios } from "@kaciras-blog/server/lib/axios-helper";
import KacirasService from "@kaciras-blog/server";
import { runServer } from "@kaciras-blog/server/lib/create-server";
import getBlogPlugin from "@kaciras-blog/server/lib/blog-plugin";
import ServerAPI from "@kaciras-blog/server/lib/ServerAPI";
import { createHotMiddleware, createKoaWebpack } from "./plugins/dev";
import VueSSRHotReloader from "./plugins/vue";
import ClientConfiguration from "./webpack/client.config";
import ServerConfiguration from "./webpack/server.config";
import { CliDevelopmentOptions } from "./options";


const service = new KacirasService<CliDevelopmentOptions>();

/**
 * 调用 webpack，并输出更友好的信息。
 *
 * @param config webpack的配置
 */
async function invokeWebpack(config: Configuration) {
	const stats = await promisify<Configuration, Stats>(webpack)(config);

	process.stdout.write(stats.toString({
		colors: true,
		modules: false,
		children: false, // Setting this to true will make TypeScript errors show up during build.
		chunks: false,
		chunkModules: false,
	}) + "\n\n");

	if (stats.hasErrors()) {
		console.log(chalk.red("Build failed with errors.\n"));
		process.exit(1);
	}
}

/**
 * 启动开发服务器，它提供了热重载功能。
 */
service.registerCommand("serve", async (options: CliDevelopmentOptions) => {
	await configureGlobalAxios(options.blog.https, options.blog.serverCert);

	const api = new ServerAPI();
	api.addPlugin(getBlogPlugin(options.blog));

	const clientConfig = ClientConfiguration(options);
	const vueSSRHotReloader = VueSSRHotReloader.create(clientConfig, options);

	if (options.dev.useHotClient !== false) {
		api.useBeforeFilter(await createKoaWebpack(clientConfig));
	} else {
		api.useBeforeFilter(await createHotMiddleware(clientConfig));
	}

	api.useFallBack(await vueSSRHotReloader.getKoaMiddleware());

	await runServer(api.createApp().callback(), options.server);
	console.info(`\n- Local URL: https://localhost/\n`);
});

service.registerCommand("build", async (options: CliDevelopmentOptions) => {
	await fs.remove(options.outputDir);
	await invokeWebpack(ClientConfiguration(options));
	await invokeWebpack(ServerConfiguration(options));
	console.log(chalk.cyan("Build complete.\n"));
});

export default service;
