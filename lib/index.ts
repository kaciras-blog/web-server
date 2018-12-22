import { getLogger } from "log4js";
import { Options } from "webpack";
import build from "./plugins/build";
import service from "./plugins/service";


export default function (options: WebServerConfiguration) {
	// 捕获全局异常记录到日志中。
	const logger = getLogger("system");
	process.on("unhandledRejection", (reason, promise) => logger.error("Unhandled", reason, promise));
	process.on("uncaughtException", err => logger.error(err.message, err.stack));

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
	port?: number,
	httpsPort?: number,
	tls?: boolean,
	certificate?: string,
	privatekey?: string,
	redirectHttp?: boolean,
}

export interface DevelopmentOptions {
	useHotClient?: boolean,
	slient?: boolean,
}

export interface WebpackOptions {
	mode: "development" | "production" | "none";

	outputPath: string,	// webpack的输出目录
	publicPath: string,	// 公共资源的URL前缀，可以设为外部服务器等
	assetsDirectory: string,	// 公共资源输出目录，是outputPath的子目录

	bundleAnalyzerReport: boolean,

	client: {
		useBabel: boolean,
		parallel: boolean, // 多线程编译JS文件
		devtool: Options.Devtool;
		cssSourceMap: boolean,
	},

	server: {
		devtool: Options.Devtool; // 服务端没有eval模式
		cssSourceMap: boolean,
	},

	vueLoader?: any;
}
