import path from "path";
import parseArgs from "minimist";
import serve from "koa-static";
import log4js from "log4js";
import { buildCache } from "@kaciras-blog/image/lib/build-image-cache";
import ApplicationBuilder from "./ApplicationBuilder";
import getBlogPlugin from "./blog-plugin";
import { createSSRProductionPlugin } from "./ssr-middleware";
import { runServer } from "./create-server";
import { configureLog4js, configureGlobalAxios } from "./helpers";
import { BlogServerOptions } from "./options";

const logger = log4js.getLogger();

type CommandHandler<T> = (options: T) => void | Promise<any>;

async function runProd(options: BlogServerOptions) {
	await configureGlobalAxios(options.blog.serverAddress, options.blog.serverCert);

	const api = new ApplicationBuilder();
	api.addPlugin(getBlogPlugin(options.blog));
	api.addPlugin(await createSSRProductionPlugin(options.outputDir));

	api.useResource(serve(options.outputDir, {
		index: false,
		maxAge: 31536000,
	}));

	await runServer(api.build().callback(), options.server);
	logger.info("启动完毕");
}

/**
 * 简单的启动器，提供注册命令然后从命令行里调用的功能，并对启动参数做一些处理。
 */
export default class Launcher<T extends BlogServerOptions> {

	private commands = new Map<string, CommandHandler<T>>();

	// 注册几个内置命令
	constructor() {
		this.registerCommand("run", runProd);
		this.registerCommand("build-image-cache", ((options) => buildCache(options.blog.imageRoot)));
	}

	registerCommand(command: string, handler: CommandHandler<T>) {
		this.commands.set(command, handler);
	}

	run(argv: string[]) {
		// 添加当前工作目录到模块路径中，在使用 npm link 本地安装时需要。
		process.env.NODE_PATH = path.resolve("node_modules");
		require("module").Module._initPaths();

		const args = parseArgs(argv);
		let configFile = path.join(process.cwd(), "config");

		if (args.profile) {
			configFile = path.join(configFile, args.profile);
		}

		// 使用 require.resolve 而不是直接 require，以便把配置文件内部的异常区分开
		try {
			require.resolve(configFile);
		} catch (e) {
			console.error("Can not find config file: " + configFile);
			process.exit(1);
		}

		// TODO: 听说 Node 以后会移除 unhandledRejection
		process.on("uncaughtException", (err) => logger.error(err.message, err.stack));
		process.on("unhandledRejection", (reason, promise) => logger.error("Unhandled", reason, promise));
		configureLog4js({ level: "info" });

		const handler = this.commands.get(args._[0]);
		if (handler) {
			return handler(require(configFile));
		}

		const names = Array.from(this.commands.keys()).join(", ");
		logger.error(`未知的命令：${args._[0]}，支持的命令有：${names}`);
	}
}
