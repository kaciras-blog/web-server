import axios from "axios";
import { IncomingHttpHeaders, IncomingHttpStatusHeader } from "http2";
import log4js, { Configuration, getLogger } from "log4js";


/**
 * 修改Axios使其支持内置Node的http2模块。
 * 注意该函数还在页面的API模块中使用了，用于服务端渲染。
 */
export function adaptAxiosHttp2 () {

	// 在使用webpack打包时会修改导入，所以这里得变通一下。
	/* tslint:disable:no-eval */
	const http2 = eval("require")("http2");

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
adaptAxiosHttp2();
