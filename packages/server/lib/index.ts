import path from "path";
import parseArgs from "minimist";
import log4js from "log4js";
import serve from "koa-static";
import { runServer } from "./create-server";
import { configureGlobalAxios } from "./axios-helper";
import getBlogPlugin from "./blog-plugin";
import ApplicationBuilder from "./ApplicationBuilder";
import { createSSRProductionPlugin } from "./vue-ssr-middleware";
import { CliServerOptions } from "./options";
import { buildCache } from "@kaciras-blog/image/lib/build-image-cache";

const logger = log4js.getLogger();

interface SimpleLogConfig {
	level: string;
	file?: string;

	/**
	 * 即使用了文件日志，还是保持控制台输出，使用此选项可以关闭控制台的输出。
	 * 【注意】很多日志处理系统默认读取标准流，所以不建议关闭。
	 */
	noConsole?: boolean;
}

/**
 * 简单地配置一下日志，文档见：
 * https://log4js-node.github.io/log4js-node/appenders.html
 */
function configureLog4js({ level, file, noConsole }: SimpleLogConfig) {
	const logConfig: log4js.Configuration = {
		appenders: {
			console: {
				type: "stdout",
				layout: {
					type: "pattern",
					pattern: "%[%d{yyyy-MM-dd hh:mm:ss} [%p] %c - %]%m",
				},
			},
		},
		categories: {
			default: { appenders: ["console"], level },
		},
	};
	if (noConsole) {
		logConfig.categories.default.appenders = [];
	}
	if (file) {
		logConfig.appenders.file = {
			type: "file",
			filename: file,
			flags: "w",
			encoding: "utf-8",
			layout: {
				type: "pattern",
				pattern: "%d{yyyy-MM-dd hh:mm:ss} [%p] %c - %m",
			},
		};
		logConfig.categories.default.appenders.push("file");
	}
	log4js.configure(logConfig);
}

type CommandHandler<T> = (options: T) => void | Promise<any>;

async function runProd(options: CliServerOptions) {
	await configureGlobalAxios(options.blog.https, options.blog.serverCert);

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
export default class KacirasService<T extends CliServerOptions> {

	private commands = new Map<string, CommandHandler<T>>();

	// 先注册个内置命令
	constructor() {
		this.registerCommand("run", runProd);
		this.registerCommand("build-image-cache", ((options) => buildCache(options.blog.imageRoot)));
	}

	registerCommand(command: string, handler: CommandHandler<T>) {
		this.commands.set(command, handler);
	}

	run() {
		configureLog4js({ level: "info" });

		// TODO: 听说 Node 以后会移除 unhandledRejection
		process.on("unhandledRejection", (reason, promise) => logger.error("Unhandled", reason, promise));
		process.on("uncaughtException", (err) => logger.error(err.message, err.stack));

		// 添加当前工作目录到模块路径中，在使用 npm link 本地安装时需要。
		// TODO: run 还是不能以那头优先
		process.env.NODE_PATH = path.resolve("node_modules");
		require("module").Module._initPaths();

		const args = parseArgs(process.argv.slice(2));
		let configFile = path.join(process.cwd(), "config");

		if (args.profile) {
			configFile = path.join(configFile, args.profile);
		}

		// 使用 require.resolve 而不是直接 require，以便把配置文件内部的异常区分开
		try {
			require.resolve(configFile);
		} catch (e) {
			return logger.error("找不到配置文件：" + configFile);
		}

		const handler = this.commands.get(args._[0]);
		if (handler) {
			return handler(require(configFile));
		}

		const names = Array.from(this.commands.keys()).join(",");
		logger.error(`未知的命令：${args._[0]}，支持的命令有：${names}`);
	}
}
