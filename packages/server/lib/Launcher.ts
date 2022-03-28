import process from "process";
import path from "path";
import { createRequire } from "module";
import parseArgs from "minimist";
import log4js from "log4js";
import { buildCache } from "@kaciras-blog/media";
import run from "./command/run.js";
import { resolveConfig, ResolvedConfig } from "./config.js";
import { once } from "./functions.js";
import { Awaitable } from "vitest";

const logger = log4js.getLogger("init");

/*
 * 第二版中不再捕获 uncaughtException 和 unhandledRejection, let it crash.
 * 请求中的错误由框架（Koa）捕获，如果进程中止考虑在外层比如 systemd 中重启。
 */

const require = createRequire(import.meta.url);

export async function loadConfig(profile: string) {
	let file = path.join(process.cwd(), "config");
	if (profile) {
		file = path.join(file, profile);
	}

	// 先 resolve 一下，以便把配置文件内部的异常区分开。
	try {
		file = require.resolve(file);
	} catch (e) {
		console.error("Can not find config file: " + file);
		process.exit(1);
	}

	const config = (await import("file://" + file)).default;
	return { config: resolveConfig(config), file };
}

function onExit(handler: () => unknown) {
	const signals: NodeJS.Signals[] = ["SIGINT", "SIGTERM", "SIGQUIT"];
	handler = once(handler);
	signals.forEach(signal => process.on(signal, handler));
}

/**
 * 命令处理函数，用来定义一个启动命令。
 *
 * <h2>关闭方式</h2>
 * AbortSignal 比起返回关闭函数更灵活，而且把运行看作一个过程的话，中断也符合语境。
 *
 * @param options 应用的配置
 * @param signal 在关闭时取消的信号。
 */
type CommandHandler<T> = (options: T, signal: AbortSignal) => Awaitable<void>;

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

		const args = parseArgs(argv);
		const { config, file } = await loadConfig(args.profile);
		logger.info(`Use config file: ${file}`);

		const command = args._[0];
		const handler = this.commands.get(command);
		if (!handler) {
			const names = Array.from(this.commands.keys()).join(", ");
			console.error(`Unknown command: ${command}, supported: ${names}`);
			process.exit(2);
		}

		process.title = `Kaciras Blog - ${command}`;

		const controller = new AbortController();
		await handler(config, controller.signal);

		onExit(() => {
			controller.abort();
			logger.info("Signal detected, stopping application...");
		});
	}
}
