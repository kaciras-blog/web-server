import Axios, { AxiosInstance } from "axios";
import http2, { IncomingHttpHeaders, IncomingHttpStatusHeader } from "http2";
import Koa, { Middleware } from "koa";
import log4js, { Configuration, getLogger } from "log4js";
import path from "path";
import { configureApp, createServer } from "./app";
import ssr from "./vue-ssr";
import { createBundleRenderer } from "vue-server-renderer";
import fs from "fs-extra";
import parseArgs from "minimist";


require("source-map-support").install();

/**
 * 修改Axios使其支持内置Node的http2模块。
 * Axios是不是放弃维护了？
 */
export function adaptAxiosHttp2 (axios: AxiosInstance, https = false) {
	const schema = https ? "https" : "http";

	function request (options: any, callback: any) {
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

export interface CliServerPligun {
	configureCliServer? (api: CliServerAPI): void;
}

/**
 * 把中间件按顺序分下组，便于解耦。
 */
export class CliServerAPI {

	private readonly beforeAll: Middleware[] = [];
	private readonly beforeFilter: Middleware[] = [];
	private readonly filter: Middleware[] = [];
	private readonly resource: Middleware[] = [];

	private fallBack?: Middleware;

	createApp () {
		const app = new Koa();
		const setup = app.use.bind(app);

		this.beforeAll.forEach(setup);
		this.beforeFilter.forEach(setup);
		this.filter.forEach(setup);
		this.resource.forEach(setup);

		if (this.fallBack) {
			app.use(this.fallBack);
		}
		return app;
	}

	/**
	 * 做一些全局处理的中间件，比如CORS、访问日志。
	 *
	 * @param middleware 中间件
	 */
	useBeforeAll (middleware: Middleware) {
		this.beforeAll.push(middleware);
	}

	/**
	 * 不希望被其他插件干涉的中间件，比如webpack的热更新不能被压缩。
	 *
	 * @param middleware 中间件
	 */
	useBeforeFilter (middleware: Middleware) {
		this.beforeFilter.push(middleware);
	}

	/**
	 * 拦截和资源优化的中间件，比如压缩、屏蔽、权限。
	 *
	 * @param middleware 中间件
	 */
	useFilter (middleware: Middleware) {
		this.filter.push(middleware);
	}

	/**
	 * 资源中间件，比如静态文件、图片存储服务。
	 *
	 * @param middleware 中间件
	 */
	useResource (middleware: Middleware) {
		this.resource.push(middleware);
	}

	/**
	 * 用于处理之前中间件没处理的请求。
	 * 这个中间件只能设置一次，多次调用说明插件有冲突。
	 *
	 * @param middleware 中间件
	 */
	useFallBack (middleware: Middleware) {
		if (this.fallBack) {
			throw new Error("A fall back middleware already exists.");
		}
		this.fallBack = middleware;
	}
}


async function runProd (options: any) {
	const app = new Koa();
	configureApp(app, options.blog);

	function reslove (file: string) {
		return path.resolve(options.webpack.outputPath, file);
	}

	const renderer = createBundleRenderer(reslove("vue-ssr-server-bundle.json"), {
		runInNewContext: false,
		template: await fs.readFile(reslove("index.template.html"), { encoding: "utf-8" }),
		clientManifest: require(reslove("vue-ssr-client-manifest.json")),
	});

	app.use(ssr({ renderer }));
	createServer(app.callback(), options.server);
}

type CommandHandler = (options: any) => void | Promise<void>;

export default class KacirasService {

	private commands = new Map<string, CommandHandler>();

	// 先注册个内置命令
	constructor () {
		this.registerCommand("run", runProd);
	}

	registerCommand (command: string, handler: CommandHandler) {
		this.commands.set(command, handler);
	}

	run () {
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
