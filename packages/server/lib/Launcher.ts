import process from "process";
import path from "path";
import { createRequire } from "module";
import parseArgs from "minimist";
import log4js from "log4js";
import { buildCache } from "@kaciras-blog/media";
import run from "./command/run.js";
import { resolveConfig, ResolvedConfig } from "./config.js";
import { once } from "./functions.js";

/*
 * 在第二版中不再捕获 uncaughtException 和 unhandledRejection, let it crash.
 * 请求中的错误由框架（Koa）捕获，如果进程中止考虑在外层比如 systemd 中重启。
 */

const require = createRequire(import.meta.url);

export async function loadConfig(profile: string) {
	let configFile = path.join(process.cwd(), "config");
	if (profile) {
		configFile = path.join(configFile, profile);
	}

	// 先 resolve 一下，以便把配置文件内部的异常区分开
	try {
		configFile = require.resolve(configFile);
	} catch (e) {
		console.error("Can not find config file: " + configFile);
		process.exit(1);
	}

	configFile = "file://" + configFile;
	return resolveConfig((await import(configFile)).default);
}

/**
 * 如果返回函数（或函数数组），那么这些函数将在程序退出时调用。
 */
type HandlerRV = void | (() => void);
type CommandHandler<T> = (options: T) => HandlerRV | Promise<HandlerRV>;

/**
 * 简单的启动器，提供注册命令然后从命令行里调用的功能，并对启动参数做一些处理。
 */
export default class Launcher {

	private readonly commands = new Map<string, CommandHandler<any>>();

	// 注册几个内置命令
	constructor() {
		this.registerCommand("run", run);
		this.registerCommand("build-cache", buildCache);
	}

	registerCommand<T extends ResolvedConfig>(command: string, handler: CommandHandler<T>) {
		this.commands.set(command, handler);
	}

	async run(argv: string[]) {
		// 添加当前工作目录到模块路径中，在使用 npm link 本地安装时需要。
		process.env.NODE_PATH = path.resolve("node_modules");
		require("module").Module._initPaths();

		const args = parseArgs(argv);
		const config = await loadConfig(args.profile);

		log4js.configure({
			appenders: {
				console: {
					type: "console",
					layout: { type: "pattern", pattern: "%[%c - %]%m" },
				},
			},
			categories: {
				default: { appenders: ["console"], level: "debug" },
			},
		});

		const logger = log4js.getLogger("init");

		const command = args._[0];
		const handler = this.commands.get(command);
		if (!handler) {
			const names = Array.from(this.commands.keys()).join(", ");
			console.error(`Unknown command: ${command}, supported commands: ${names}`);
			process.exit(2);
		}

		process.title = `Kaciras Blog - ${command}`;

		Promise.resolve(handler(config)).then(shutdownHook => {
			const shutdownHandler = once(() => {
				if (shutdownHook) {
					shutdownHook();
				}
				logger.info("Stopping application...");
			});
			const signals: NodeJS.Signals[] = ["SIGINT", "SIGTERM", "SIGQUIT"];
			signals.forEach(signal => process.on(signal, shutdownHandler));
		});
	}
}
