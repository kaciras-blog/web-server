import Axios, { AxiosInstance } from "axios";
import http2, { IncomingHttpHeaders, IncomingHttpStatusHeader } from "http2";
import log4js, { Configuration, getLogger } from "log4js";
import parseArgs from "minimist";
import path from "path";
import { runServer } from "./app";
import BlogPlugin from "./BlogPlugin";
import { CliServerOptions } from "./OldOptions";
import ServerAPI from "./ServerAPI";
import VueSSRProductionPlugin from "./VueSSR";
import { precompress } from "./static-compress";
import globby from "globby";


/**
 * 修改Axios使其支持内置Node的http2模块。
 * Axios是不是放弃维护了？
 */
export function adaptAxiosHttp2(axios: AxiosInstance, https = false) {
	const schema = https ? "https" : "http";

	function request(options: any, callback: any) {
		let host = `${schema}://${options.hostname}`;
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
function configureLog4js({ logLevel, logFile }: { logLevel: string, logFile: string | boolean }) {
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

export interface CliServerPligun {
	configureCliServer?(api: ServerAPI): void;
}


async function runProd(options: CliServerOptions) {
	const api = new ServerAPI();

	const root = "D:\\Project\\Blog\\WebContent\\dist";
	const resources = await globby([root + "/**/*.{js,css,svg}", root + "/app-shell.html"]);
	await precompress(resources, 1024);

	const bp = new BlogPlugin(options.blog);
	bp.configureCliServer(api);

	const ssrPlugin = new VueSSRProductionPlugin(options.blog.staticRoot);
	ssrPlugin.configureCliServer(api);

	return runServer(api.createApp().callback(), options.server);
}

type CommandHandler<T> = (options: T) => void | Promise<any>;

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

		// TODO: TEMP
		// 其它服务启用了HTTPS，但对于内部调用来说证书的CN不是localhost，需要关闭证书检查
		process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
		adaptAxiosHttp2(Axios, true);

		// 捕获全局异常记录到日志中。
		const logger = getLogger("system");
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
