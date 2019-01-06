import axios from "axios";
import http2 from "http2";
import { IncomingHttpHeaders, IncomingHttpStatusHeader } from "http2";
import log4js, { Configuration, getLogger } from "log4js";
import {createApp, createServer} from "./app";


require("source-map-support").install();

/**
 * 修改Axios使其支持内置Node的http2模块。
 */
export function adaptAxiosHttp2 () {

	function request (options: any, callback: any) {
		let host = `https://${options.hostname}`;
		if (options.port) {
			host += ":" + options.port;
		}

		const client = http2.connect(host);
		const req: any = client.request({
			...options.headers,
			":method": options.method.toUpperCase(),
			":path": options.path,
		});

		req.on("response", (headers: IncomingHttpHeaders & IncomingHttpStatusHeader) => {
			req.headers = headers;
			req.statusCode = headers[":status"];
			callback(req);
		});
		req.on("end", () => client.close());
		return req;
	}

	// 修改Axios默认的transport属性，注意该属性是内部使用没有定义在接口里
	(axios.defaults as any).transport = { request };
}

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


configureLog4js({ logFile: false, logLevel: "info" });

// 捕获全局异常记录到日志中。
const logger = getLogger("system");
process.on("unhandledRejection", (reason, promise) => logger.error("Unhandled", reason, promise));
process.on("uncaughtException", (err) => logger.error(err.message, err.stack));


switch (process.argv[2]) {
	case "build":
		break;
	case "serve":
		break;
	case "prod":
	default:
		break;
}

// 其它服务启用了HTTPS，但对于内部调用来说证书的CN不是localhost，需要关闭证书检查
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

adaptAxiosHttp2();
