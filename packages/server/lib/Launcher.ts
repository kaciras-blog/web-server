import path from "path";
import parseArgs from "minimist";
import log4js from "log4js";
import { buildCache } from "@kaciras-blog/image/lib/build-image-cache";
import { configureLog4js } from "./helpers";
import { BlogServerOptions } from "./options";

/**
 * 如果返回函数（或函数数组），那么这些函数将在程序退出时调用。
 */
type HandlerRV = void | (() => void);
type CommandHandler<T> = (options: T) => HandlerRV | Promise<HandlerRV>;

/**
 * 简单的启动器，提供注册命令然后从命令行里调用的功能，并对启动参数做一些处理。
 */
export default class Launcher<T extends BlogServerOptions> {

	private commands = new Map<string, CommandHandler<T>>();

	// 注册几个内置命令
	constructor() {
		this.registerCommand("run", require("./command/run"));
		this.registerCommand("build-image-cache", ((options) => buildCache(options.app.dataDir)));
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

		configureLog4js(config.app.logging);
		const logger = log4js.getLogger("init");

		// TODO: 听说 Node 以后会移除 unhandledRejection
		process.on("uncaughtException", (err) => logger.error(err.message, err.stack));
		process.on("unhandledRejection", (reason, promise) => logger.error("Unhandled", reason, promise));

		const command = args._[0];
		const handler = this.commands.get(command);
		if (!handler) {
			const names = Array.from(this.commands.keys()).join(", ");
			console.error(`Unknown command: ${command}, supported commands: ${names}`);
			process.exit(2);
		}

		process.title = `Kaciras Blog - ${command}`;

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
