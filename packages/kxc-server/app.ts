import fs from "fs-extra";
import http, { IncomingMessage, ServerResponse } from "http";
import http2, { Http2ServerRequest, Http2ServerResponse } from "http2";
import { Server } from "net";
import { createSecureContext, SecureContext } from "tls";
import log4js from "log4js";


const logger = log4js.getLogger("app");

export interface SNIProperties {
	hostname: string;
	key: string;
	cert: string;
}

export interface ServerOptions {
	port?: number;
	httpsPort?: number;
	tls?: boolean;
	certificate?: string;
	privatekey?: string;
	sni?: SNIProperties[];
	redirectHttp?: boolean;
}

// app.callback() 的定义，比较长不方便直接写在参数里
type OnRequestHandler = (req: IncomingMessage | Http2ServerRequest, res: ServerResponse | Http2ServerResponse) => void;
type SNIResolve = (err: Error | null, ctx: SecureContext) => void;


export function createSNICallback(properties: SNIProperties[]) {
	const map: { [k: string]: any } = {};

	// 据测试SecureContext可以重用
	for (const p of properties) {
		map[p.hostname] = createSecureContext({
			key: fs.readFileSync(p.key),
			cert: fs.readFileSync(p.cert),
		});
	}
	return (servername: string, callback: SNIResolve) => callback(null, map[servername]);
}


/**
 * 将 Server.listen 转成异步方法并调用。
 *
 * @param server 服务器
 * @param port 端口
 * @return 返回server参数
 */
function listenAsync(server: Server, port: number): Promise<Server> {
	return new Promise((resolve) => server.listen(port, () => resolve(server)));
}

export async function runServer(requestHandler: OnRequestHandler, options: ServerOptions) {
	const { port = 80, httpsPort = 443 } = options;
	const servers: Server[] = [];

	if (options.tls) {
		const { privatekey, certificate, sni } = options;
		const sniCallback = sni && createSNICallback(sni);

		if (!privatekey || !certificate) {
			throw new Error("You must specifiy privatekey and certificate with tls enabled.");
		}
		const server = http2.createSecureServer({
			allowHTTP1: true,
			SNICallback: sniCallback,
			cert: fs.readFileSync(certificate),
			key: fs.readFileSync(privatekey),
		}, requestHandler);

		servers.push(await listenAsync(server, httpsPort));
		logger.info(`Https连接端口：${httpsPort}`);
	}

	if (options.redirectHttp) {
		const portPart = httpsPort === 443 ? "" : ":" + httpsPort;

		const server = http.createServer((req, res) => {
			res.writeHead(301, { Location: `https://${req.headers.host}${portPart}${req.url}` }).end();
		});
		servers.push(await listenAsync(server, port));
		logger.info(`重定向来自端口：${port}的请求至：${httpsPort}`);
	} else {
		const server = http.createServer(requestHandler);
		servers.push(await listenAsync(server, port));
		logger.info(`在端口：${port}上监听Http连接`);
	}

	// Keep-Alive 的连接无法关闭，反而会使close方法一直等待，所以close的参数里没有回调
	return () => servers.forEach((s) => s.close());
}
