import chalk from "chalk";
import fs from "fs-extra";
import KacirasService from "kxc-server";
import { runServer } from "kxc-server/infra/create-server";
import BlogPlugin from "kxc-server/BlogPlugin";
import ServerAPI from "kxc-server/infra/ServerAPI";
import { ssrMiddleware } from "kxc-server/VueSSR";
import { promisify } from "util";
import webpack, { Configuration, Stats } from "webpack";
import hotReloadMiddleware from "./plugins/dev";
import VueSSRHotReloader from "./plugins/vue";
import ClientConfiguration from "./webpack/client.config";
import ServerConfiguration from "./webpack/server.config";
import { configureGlobalAxios } from "kxc-server/axios-http2";
import { Options } from "webpack";
import { CliServerOptions } from "kxc-server";


export interface WebpackOptions {
	mode: "development" | "production" | "none";
	publicPath: string; // 公共资源的URL前缀，可以设为外部服务器等
	parallel: boolean; // 多线程编译JS文件
	bundleAnalyzerReport: any;

	client: {
		useBabel: boolean,
		devtool: Options.Devtool;
		cssSourceMap: boolean,
	};

	server: {
		devtool: Options.Devtool; // 服务端没有eval模式
		cssSourceMap: boolean,
	};

	vueLoader?: any;
}

export interface DevServerOptions {
	silent: boolean;
	useHotClient: boolean;
}

export interface CliDevelopmentOptions extends CliServerOptions {
	webpack: WebpackOptions;
	dev: DevServerOptions;
}

const service = new KacirasService<CliDevelopmentOptions>();

/**
 * 调用webpack，并输出更友好的信息。
 *
 * @param config 配置
 * @return {Promise<void>} 指示构建状态
 */
async function invokeWebpack(config: Configuration) {
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

service.registerCommand("serve", async (options: CliDevelopmentOptions) => {
	await configureGlobalAxios(options.blog.serverCert);

	const clientConfig = ClientConfiguration(options);
	const ssrPlugin = VueSSRHotReloader.create(clientConfig, options);

	const api = new ServerAPI();
	api.addPlugin(new BlogPlugin(options.blog));

	api.useBeforeFilter(await hotReloadMiddleware(options.dev.useHotClient, clientConfig));
	api.useFallBack(ssrMiddleware({ renderer: await ssrPlugin.getRendererFactory() }));

	await runServer(api.createApp().callback(), options.server);
	console.info(`\n- Local URL: https://localhost/\n`);
});

service.registerCommand("build", async (config) => {
	await fs.remove(config.outputDir);
	await invokeWebpack(ClientConfiguration(config));
	await invokeWebpack(ServerConfiguration(config));

	console.log(chalk.cyan("Build complete.\n"));
});

export default service;
