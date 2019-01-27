import { promisify } from "util";
import { Server } from "net";
import http, { IncomingMessage, ServerResponse } from "http";
import http2, { Http2ServerRequest, Http2ServerResponse } from "http2";
import cors, { Options as CorsOptions } from "@koa/cors";
import fs from "fs-extra";
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

export function runServer (requestHandler: OnRequestHandler, options: CliServerOptions) {
	const {
		port = 80, httpsPort = 4438,
		tls, privatekey, certificate, redirectHttp,
	} = options;

	let httpsServer: Server;
	let httpServer: Server;

	if (tls) {
		if (!privatekey || !certificate) {
			throw new Error("You must specifiy privatekey and certificate with tls enabled.");
		}
		httpsServer = http2.createSecureServer({
			key: fs.readFileSync(privatekey),
			cert: fs.readFileSync(certificate),
			allowHTTP1: true,
		}, requestHandler)
			.listen(httpsPort, () => logger.info(`Https连接端口：${httpsPort}`));
	}

	if (redirectHttp) {
		httpServer = http.createServer((req, res) => {
			res.writeHead(301, { Location: "https://" + req.headers.host + req.url });
			res.end();
		}).listen(port, () => logger.info(`重定向来自端口：${port}的请求至：${httpsPort}`));
	} else {
		httpServer = http.createServer(requestHandler)
			.listen(port, () => logger.info(`在端口：${port}上监听Http连接`));
	}

	async function cleanup () {
		try {
			if (httpServer) {
				await promisify(httpServer.close)();
			}
			if (httpsServer) {
				await promisify(httpsServer.close)();
			}
			process.exit(0);
		} catch (e) {
			logger.fatal("Error occured when closing servers", e);
			process.exit(1);
		}
	}

	process.on("SIGINT", cleanup);
	process.on("SIGTERM", cleanup);
}
