import cors, { Options as CorsOptions } from "@koa/cors";
import fs from "fs-extra";
import http, { IncomingMessage, ServerResponse } from "http";
import http2, { Http2ServerRequest, Http2ServerResponse } from "http2";
import Koa from "koa";
import compress from "koa-compress";
import conditional from "koa-conditional-get";
import etag from "koa-etag";
import multer from "koa-multer";
import log4js from "log4js";
import { intercept, createSitemapMiddleware, createImageMiddleware, ImageMiddlewareOptions } from "./middleware";
import serve from "koa-static";


const logger = log4js.getLogger("app");

export interface AppOptions {
	cors?: CorsOptions;
	serverAddress: string;
	staticRoot: string;
}

export function configureApp (app: Koa, options: AppOptions & ImageMiddlewareOptions) {
	app.use(cors(options.cors));
	app.use(conditional());

	const uploader = multer({ limits: { fileSize: 16 * 1024 * 1024 } });
	app.use(uploader.single("file"));

	app.use(intercept([
		"/index.template.html",
		"/vue-ssr-client-manifest.json",
		"/vue-ssr-server-bundle.json",
	]));

	app.use(createImageMiddleware(options)); // 图片太大不计算etag
	app.use(compress({ threshold: 2048 }));
	app.use(createSitemapMiddleware(options.serverAddress));
	app.use(etag());

	app.use(serve(options.staticRoot, {
		index: false,
		maxage: 30 * 86400 * 1000,
	}));

	return app;
}

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
//

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

export function createServer (requestHandler: OnRequestHandler, options: CliServerOptions) {
	const {
		port = 80, httpsPort = 443,
		tls, privatekey, certificate, redirectHttp,
	} = options;

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
