import path from "path";
import parseArgs from "minimist";
import log4js from "log4js";
import { buildCache } from "@kaciras-blog/image/lib/build-image-cache";
import ApplicationBuilder from "./ApplicationBuilder";
import getBlogPlugin from "./blog-plugin";
import { createSSRProductionPlugin } from "./ssr-middleware";
import { runServer } from "./create-server";
import { configureLog4js, configureGlobalAxios } from "./helpers";
import staticFiles from "./static-files";
import { BlogServerOptions } from "./options";

const logger = log4js.getLogger();

/**
 * 如果返回函数（或函数数组），那么这些函数将在程序退出时调用。
 */
type HandlerRV = void | (() => void);
type CommandHandler<T> = (options: T) => HandlerRV | Promise<HandlerRV>;

async function runProd(options: BlogServerOptions) {
	const closeHttp2Sessions = await configureGlobalAxios(options.blog.serverAddress, options.blog.serverCert);

	const builder = new ApplicationBuilder();
	builder.addPlugin(getBlogPlugin(options.blog));
	builder.addPlugin(await createSSRProductionPlugin(options.outputDir));

	// 除了static目录外文件名都不带Hash，所以要禁用外层的缓存
	builder.useResource(staticFiles(options.outputDir, {
		staticAssets: new RegExp("^/" + options.assetsDir),
	}));

	const app = builder.build();
	app.proxy = !!options.blog.useForwardedHeaders;

	const closeServer = await runServer(app.callback(), options.server);
	logger.info("Startup completed.");

	return () => { closeServer(); closeHttp2Sessions(); }
}

/**
 * 简单的启动器，提供注册命令然后从命令行里调用的功能，并对启动参数做一些处理。
 */
export default class Launcher<T extends BlogServerOptions> {

	private commands = new Map<string, CommandHandler<T>>();

	// 注册几个内置命令
	constructor() {
		this.registerCommand("run", runProd);
		this.registerCommand("build-image-cache", ((options) => buildCache(options.blog.dataDir)));
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

		const config = require(configFile);
		configureLog4js(config.blog.logging);

		// TODO: 听说 Node 以后会移除 unhandledRejection
		process.on("uncaughtException", (err) => logger.error(err.message, err.stack));
		process.on("unhandledRejection", (reason, promise) => logger.error("Unhandled", reason, promise));

		const handler = this.commands.get(args._[0]);
		if (!handler) {
			const names = Array.from(this.commands.keys()).join(", ");
			console.error(`Unknown command: ${args._[0]}, supported commands: ${names}`);
			process.exit(2);
		}

		Promise.resolve(handler(config)).then((shutdownHook) => {
			const signals: NodeJS.Signals[] = ["SIGINT", "SIGTERM", "SIGQUIT"];
			signals.forEach((signal) => process.on(signal, () => {
				if (shutdownHook) {
					shutdownHook();
				}
				logger.info("Stopping application...");
			}));
		});
	}
}
