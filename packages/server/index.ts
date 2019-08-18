import log4js from "log4js";
import parseArgs from "minimist";
import path from "path";
import { runServer, ServerOptions } from "./create-server";
import BlogPlugin, { AppOptions } from "./BlogPlugin";
import ServerAPI from "./ServerAPI";
import { createSSRProductionPlugin } from "./VueSSR";
import { configureGlobalAxios } from "./axios-helper";
import serve from "koa-static";

const logger = log4js.getLogger();

/**
 * 配置日志功能，先于其他模块执行保证日志系统的完整。
 */
function configureLog4js({ logLevel, logFile }: { logLevel: string, logFile: string | boolean }) {
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
			default: { appenders: ["console"], level: logLevel },
		},
	};
	if (logFile) {
		logConfig.appenders.file = {
			type: "file",
			filename: logFile,
			flags: "w",
			encoding: "utf-8",
			layout: {
				type: "pattern",
				pattern: "%d{yyyy-MM-dd hh:mm:ss} [%p] %c - %m",
			},
		};
		logConfig.categories.default.appenders = ["file"];
	}
	log4js.configure(logConfig);
}

export interface CliServerOptions {
	outputDir: string;	// webpack的输出目录
	assetsDir: string;	// 公共资源的URL前缀，可以设为外部服务器等

	blog: AppOptions;
	server: ServerOptions;
}

async function runProd(options: CliServerOptions) {
	await configureGlobalAxios(options.blog.https, options.blog.serverCert);

	const api = new ServerAPI();
	api.addPlugin(new BlogPlugin(options.blog));
	api.addPlugin(await createSSRProductionPlugin(options.outputDir));

	api.useResource(serve(options.outputDir, {
		index: false,
		maxAge: 31536000,
	}));

	await runServer(api.createApp().callback(), options.server);
	logger.info("启动完毕");
}

type CommandHandler<T> = (options: T) => void | Promise<any>;

/**
 * 简单的启动器，提供注册命令然后从命令行里调用的功能，并对启动参数做一些处理。
 */
export default class KacirasService<T extends CliServerOptions> {

	private commands = new Map<string, CommandHandler<T>>();

	// 先注册个内置命令
	constructor() {
		this.registerCommand("run", runProd);
	}

	registerCommand(command: string, handler: CommandHandler<T>) {
		this.commands.set(command, handler);
	}

	run() {
		configureLog4js({ logFile: false, logLevel: "info" });

		// 捕获全局异常记录到日志中。
		process.on("unhandledRejection", (reason, promise) => logger.error("Unhandled", reason, promise));
		process.on("uncaughtException", (err) => logger.error(err.message, err.stack));

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
		if (!handler) {
			return logger.error("未知的命令：" + args._[0]);
		}
		handler(require(configFile));
	}
}
