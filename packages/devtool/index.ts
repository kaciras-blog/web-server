import { promisify } from "util";
import chalk from "chalk";
import fs from "fs-extra";
import webpack, { Configuration, Options, Stats } from "webpack";
import hotReloadMiddleware from "./plugins/dev";
import VueSSRHotReloader from "./plugins/vue";
import ClientConfiguration from "./webpack/client.config";
import ServerConfiguration from "./webpack/server.config";
import { configureGlobalAxios } from "@kaciras-blog/server/axios-http2";
import KacirasService, { CliServerOptions } from "@kaciras-blog/server";
import { runServer } from "@kaciras-blog/server/create-server";
import BlogPlugin from "@kaciras-blog/server/BlogPlugin";
import ServerAPI from "@kaciras-blog/server/ServerAPI";
import { ssrMiddleware } from "@kaciras-blog/server/VueSSR";


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

export interface EnvConfig {
	contentServerUri: string | {
		http: string;
		https: string;
	};
	webHost?: string;
	sentryDSN?: string;
	googleTagManager?: string;
}

export interface CliDevelopmentOptions extends CliServerOptions {
	dev: DevServerOptions;
	webpack: WebpackOptions;
	envConfig: EnvConfig;
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
		children: false, // Setting this to true will make TypeScript errors show up during build.
		chunks: false,
		chunkModules: false,
	}) + "\n\n");

	if (stats.hasErrors()) {
		console.log(chalk.red("Build failed with errors.\n"));
		process.exit(1);
	}
}

service.registerCommand("serve", async (options: CliDevelopmentOptions) => {
	await configureGlobalAxios(options.blog.https, options.blog.serverCert);

	const api = new ServerAPI();
	api.addPlugin(new BlogPlugin(options.blog));

	const clientConfig = ClientConfiguration(options);
	api.useBeforeFilter(await hotReloadMiddleware(options.dev.useHotClient, clientConfig));

	const vueSSRHotReloader = VueSSRHotReloader.create(clientConfig, options);
	api.useFallBack(ssrMiddleware({ renderer: await vueSSRHotReloader.getRendererFactory() }));

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
