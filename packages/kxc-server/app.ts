import fs from "fs-extra";
import http, { IncomingMessage, ServerResponse } from "http";
import http2, { Http2ServerRequest, Http2ServerResponse } from "http2";
import { Server } from "net";
import { createSecureContext, SecureContext } from "tls";
import log4js from "log4js";


const logger = log4js.getLogger("app");

export interface ServerOptions {
	port?: number;
	tls?: TLSOptions;
	httpRedirect?: number | true;
}

export interface TLSOptions {
	keyFile: string;
	certFile: string;
	sni?: SNIProperties[];
}

export interface SNIProperties {
	hostname: string;
	key: string;
	cert: string;
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

/**
 * 创建并启动一个或多个服务器，返回关闭它们的函数。
 *
 * @param requestHandler 处理请求的函数
 * @param options 选项
 * @return 关闭创建的服务器的函数
 */
export async function runServer(requestHandler: OnRequestHandler, options: ServerOptions) {
	let port = options.port || 443;
	const servers: Server[] = [];

	if (options.tls) {
		const { certFile, keyFile, sni } = options.tls;

		const server = http2.createSecureServer({
			allowHTTP1: true,
			cert: fs.readFileSync(certFile),
			key: fs.readFileSync(keyFile),
			SNICallback: sni && createSNICallback(sni),
		}, requestHandler);

		servers.push(await listenAsync(server, port));
		logger.info(`Https连接端口：${port}`);
	} else {
		port = options.port || 80;
		const server = http.createServer(requestHandler);

		servers.push(await listenAsync(server, port));
		logger.info(`在端口：${port}上监听Http连接`);
	}

	if (options.httpRedirect) {
		if (!options.tls) {
			throw new Error("没开HTTPS重定向个即把");
		}
		const rPort = options.httpRedirect === true ? 80 : options.httpRedirect;
		const portPart = port === 443 ? "" : ":" + port;

		const server = http.createServer((req, res) => {
			res.writeHead(301, { Location: `https://${req.headers.host}${portPart}${req.url}` }).end();
		});
		servers.push(await listenAsync(server, rPort));
		logger.info(`重定向来自端口：${rPort}的请求至：${port}`);
	}

	// Keep-Alive 的连接无法关闭，反而会使close方法一直等待，所以close的参数里没有回调
	return () => servers.forEach((s) => s.close());
}
