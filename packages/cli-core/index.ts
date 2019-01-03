import { getLogger } from "log4js";
import { Options } from "webpack";
import build from "../cli-dev/plugins/build";
import service from "cli-server";
import log4js, { Configuration } from "log4js";

require("source-map-support").install();


/**
 * 配置日志功能，先于其他模块执行保证日志系统的完整。
 */
function configureLog4js ({ logLevel, logFile }: { logLevel: string, logFile: string | boolean }) {
	const logConfig: Configuration = {
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


/* =========================================================================== *\
								配置选项定义
\* =========================================================================== */

export interface WebServerConfiguration {
	server?: ServerOptions;
	dev?: DevelopmentOptions;
	webpack?: WebpackOptions;
}

export interface ServerOptions {
	port?: number;
	httpsPort?: number;
	tls?: boolean;
	certificate?: string;
	privatekey?: string;
	redirectHttp?: boolean;
}

export interface DevelopmentOptions {
	useHotClient?: boolean;
	slient?: boolean;
}

export interface WebpackOptions {
	mode: "development" | "production" | "none";

	outputPath: string;	// webpack的输出目录
	publicPath: string;	// 公共资源的URL前缀，可以设为外部服务器等
	assetsDirectory: string;	// 公共资源输出目录，是outputPath的子目录

	bundleAnalyzerReport: boolean;

	client: {
		useBabel: boolean,
		parallel: boolean, // 多线程编译JS文件
		devtool: Options.Devtool;
		cssSourceMap: boolean,
	};

	server: {
		devtool: Options.Devtool; // 服务端没有eval模式
		cssSourceMap: boolean,
	};

	vueLoader?: any;
}

configureLog4js({ logFile: false, logLevel: "info" });

const optionsFile = process.argv[2];
if (!optionsFile) {
	console.error("Configuration not specified");
	process.exit(1);
}

// 捕获全局异常记录到日志中。
const logger = getLogger("system");
process.on("unhandledRejection", (reason, promise) => logger.error("Unhandled", reason, promise));
process.on("uncaughtException", (err) => logger.error(err.message, err.stack));

const options = require(optionsFile);
switch (process.argv[3]) {
	case "build":
		build(options.webpack);
		break;
	case "serve":
		service(options, true);
		break;
	case "run":
		service(options, false);
		break;
	default:
		logger.error("Unresloved command: " + process.argv[3]);
}
