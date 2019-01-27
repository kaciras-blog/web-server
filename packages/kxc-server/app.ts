import fs from "fs-extra";
import http, { IncomingMessage, ServerResponse } from "http";
import http2, { Http2ServerRequest, Http2ServerResponse } from "http2";
import log4js from "log4js";
import { Server } from "net";
import { promisify } from "util";


const logger = log4js.getLogger("app");


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
