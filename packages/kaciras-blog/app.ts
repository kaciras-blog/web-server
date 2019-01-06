import fs from "fs-extra";
import http, { IncomingMessage, ServerResponse } from "http";
import http2, { Http2ServerRequest, Http2ServerResponse } from "http2";
import Koa, { Middleware } from "koa";
import log4js from "log4js";

const compress = require("koa-compress");
const etag = require("koa-etag");
const conditional = require("koa-conditional-get");
const cors = require("@koa/cors");
const multer = require("koa-multer");


const logger = log4js.getLogger("app");

// 其它服务启用了HTTPS，但对于内部调用来说证书的CN不是localhost，需要关闭证书检查
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";


// function setupBasicMiddlewares (app: Koa, options: any) {
// 	app.use(cors(options.blog.cors));
// 	app.use(conditional());
//
// 	const uploader = multer({ limits: 16 * 1024 * 1024 });
// 	app.use(uploader.single("file"));
//
// 	app.use(compress({ threshold: 2048 }));
// 	blogPlugin(app, options.blog); // 图片太大不计算etag
//
// 	app.use(etag());
// 	app.use(intercept([
// 		"/index.template.html",
// 		"/vue-ssr-client-manifest.json",
// 		"/vue-ssr-server-bundle.json",
// 	]));
//
// 	app.use(serve(options.webpack.outputPath, {
// 		index: false,
// 		maxage: 30 * 86400 * 1000,
// 	}));
// }
//
// async function u (options: any, devserver: boolean /* 临时 */) {
// 	const app = new Koa();
//
// 	if (devserver) {
// 		const clientConfig = require("../cli-dev/template/client.config").default(options.webpack);
// 		configureWebpack(clientConfig);
// 		const middleware = await dev(options, clientConfig);
//
// 		app.use(middleware); // 这个得放在koa-compress前头。
// 		setupBasicMiddlewares(app, options);
// 		app.use(await devMiddleware(options));
// 	} else {
// 		logger.info("No webpack config specified, run as production mode.");
//
// 		setupBasicMiddlewares(app, options);
// 		app.use(await prodMiddleware(options));
// 	}
// }

export interface CliServerPligun {
	configureCliServer (api: CliServerAPI): void;
}

class CliServerAPI {

	private readonly beforeAll: Middleware[] = [];
	private readonly beforeFilter: Middleware[] = [];
	private readonly filter: Middleware[] = [];
	private readonly resource: Middleware[] = [];

	private fallBack?: Middleware;

	useFallBack (middleware: Middleware) {
		if (this.fallBack) {
			throw new Error("A fall back middleware already exists.");
		}
		this.fallBack = middleware;
	}

	configure (application: Koa) {
		const setup = application.use.bind(application);

		this.beforeAll.forEach(setup);
		this.beforeFilter.forEach(setup);
		this.filter.forEach(setup);
		this.resource.forEach(setup);

		if (this.fallBack) {
			application.use(this.fallBack);
		}
		return application;
	}

	useBeforeAll (middleware: Middleware): this {
		this.beforeAll.push(middleware);
		return this;
	}

	useBeforeFilter (middleware: Middleware): this {
		this.beforeFilter.push(middleware);
		return this;
	}

	useFilter (middleware: Middleware): this {
		this.filter.push(middleware);
		return this;
	}

	useResource (middleware: Middleware): this {
		this.resource.push(middleware);
		return this;
	}
}

export interface CliServerOptions {
	port?: number;
	httpsPort?: number;
	tls?: boolean;
	certificate?: string;
	privatekey?: string;
	redirectHttp?: boolean;
}

// app.callback() 的定义，比较长不方便直接写在参数里
type OnRequestHandler = (req: IncomingMessage | Http2ServerRequest, res: ServerResponse | Http2ServerResponse) => void;

export default class CliHttpService implements CliService {

	private readonly options: CliServerOptions;

	constructor (options: CliServerOptions) {
		this.options = options;
	}

	serve (plugins: any[]): void | Promise<void> {
		const api = new CliServerAPI();
		api.useBeforeAll(conditional());
		api.useBeforeAll(multer({ limits: 16 * 1024 * 1024 }).single("file"));
		api.useFilter(etag());
		api.useFilter(compress({ threshold: 2048 }));

		plugins.filter((p) => p.CliServerPligun).forEach((p) => p.CliServerPligun(api));

		const app = new Koa();
		api.configure(app);
		this.createServer(app.callback());
	}

	createServer (requestHandler: OnRequestHandler) {
		const {
			port = 80, httpsPort = 443,
			tls, privatekey, certificate, redirectHttp,
		} = this.options;

		if (tls) {
			if (!privatekey || !certificate) {
				throw new Error("You must specifiy privatekey and certificate with tls enabled.");
			}
			http2.createSecureServer({
				key: fs.readFileSync(privatekey),
				cert: fs.readFileSync(certificate),
				allowHTTP1: true,
			}, requestHandler)
				.listen(httpsPort, () => logger.info(`Https连接端口：${httpsPort}`));
		}

		if (redirectHttp) {
			http.createServer((req, res) => {
				res.writeHead(301, { Location: "https://" + req.headers.host + req.url });
				res.end();
			}).listen(port, () => logger.info(`重定向来自端口：${port}的请求至：${httpsPort}`));
		} else {
			http.createServer(requestHandler).listen(port, () => logger.info(`在端口：${port}上监听Http连接`));
		}
	}
}
