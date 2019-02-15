import fs from "fs-extra";
import http, { IncomingMessage, ServerResponse } from "http";
import http2, { Http2ServerRequest, Http2ServerResponse } from "http2";
import log4js from "log4js";


const logger = log4js.getLogger("app");


export interface ServerOptions {
	port?: number;
	httpsPort?: number;
	tls?: boolean;
	certificate?: string;
	privatekey?: string;
	redirectHttp?: boolean;
}

// app.callback() 的定义，比较长不方便直接写在参数里
type OnRequestHandler = (req: IncomingMessage | Http2ServerRequest, res: ServerResponse | Http2ServerResponse) => void;

export function runServer (requestHandler: OnRequestHandler, options: ServerOptions) {
	const { port = 80, httpsPort = 443 } = options;

	if (options.tls) {
		const { privatekey, certificate } = options;

		if (!privatekey || !certificate) {
			throw new Error("You must specifiy privatekey and certificate with tls enabled.");
		}
		http2.createSecureServer({
			key: fs.readFileSync(privatekey),
			cert: fs.readFileSync(certificate),
			allowHTTP1: true,
		}, requestHandler).listen(httpsPort, () => {
			logger.info(`Https连接端口：${httpsPort}`);
		});
	}

	if (options.redirectHttp) {
		// TODO: Remove type fix
		http.createServer((req, res: any) => {
			res.writeHead(301, { Location: `https://${req.headers.host}${req.url}` }).end();
		}).listen(port, () => {
			logger.info(`重定向来自端口：${port}的请求至：${httpsPort}`);
		});
	} else {
		http.createServer(requestHandler).listen(port, () => {
			logger.info(`在端口：${port}上监听Http连接`);
		});
	}
}
