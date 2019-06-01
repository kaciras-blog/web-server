import log4js from "log4js";
import parseArgs from "minimist";
import path from "path";
import { runServer, ServerOptions } from "./infra/create-server";
import BlogPlugin, { AppOptions } from "./BlogPlugin";
import ServerAPI from "./infra/ServerAPI";
import { createSSRProductionPlugin } from "./VueSSR";
import { compressStaticDirectory } from "./infra/static-compress";
import { configureGlobalAxios } from "./axios-http2";
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
	const staticResources = path.join(options.outputDir, options.assetsDir);

	logger.info("预压缩静态资源...");
	await compressStaticDirectory(staticResources);
	logger.info("静态资源压缩完成");

	await configureGlobalAxios(options.blog.serverCert);

	const api = new ServerAPI();
	api.addPlugin(new BlogPlugin(options.blog));
	api.addPlugin(await createSSRProductionPlugin(options.outputDir));

	api.useResource(serve(staticResources, {
		index: false,
		maxAge: 31536000,
	}));

	return runServer(api.createApp().callback(), options.server);
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
		const env = args.profile ? ("." + args.profile) : "";
		const config = require(path.join(process.cwd(), `config/webserver${env}`));

		const handler = this.commands.get(args._[0]);
		if (!handler) {
			return logger.error("No command specified"); // print command help
		}

		handler(config);
	}
}
