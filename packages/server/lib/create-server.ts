import http, { IncomingMessage, ServerResponse } from "http";
import https from "https";
import http2, { Http2ServerRequest, Http2ServerResponse } from "http2";
import { Server, Socket } from "net";
import { createSecureContext, SecureContext } from "tls";
import fs from "fs-extra";
import { HttpServerOptions, HttpsServerOptions, ServerOptions, SNIProperties } from "./options";


// app.callback() 的定义，比较长不方便直接写在参数里
type RequestMessage = IncomingMessage | Http2ServerRequest;
type OnRequestHandler = (req: RequestMessage, res: ServerResponse | Http2ServerResponse) => void;
type SNIResolve = (err: Error | null, ctx: SecureContext) => void;

export function createSNICallback(properties: SNIProperties[]) {
	const map: { [servername: string]: SecureContext } = {};

	// 据测试 SecureContext 可以重用
	for (const p of properties) {
		map[p.hostname] = createSecureContext({
			key: fs.readFileSync(p.key),
			cert: fs.readFileSync(p.cert),
		});
	}
	return (servername: string, callback: SNIResolve) => callback(null, map[servername]);
}

function createConnector(connector: HttpServerOptions | HttpsServerOptions) {
	if ("certFile" in connector) {
		const { certFile, keyFile, sni } = connector;
		const config = {
			cert: fs.readFileSync(certFile),
			key: fs.readFileSync(keyFile),
			SNICallback: sni && createSNICallback(sni),
			allowHTTP1: true,
		};
		switch (connector.version) {
			case 1:
				return https.createServer(config);
			case 2:
				return http2.createSecureServer(config);
		}
	} else {
		// http2.createServer 没有 allowHTTP1 这个参数，所以必须用 version 选项区分
		switch (connector.version) {
			case 1:
				return http.createServer();
			case 2:
				return http2.createServer();
		}
	}
}

/**
 * 创建一个重定向处理器。
 *
 * @param origin 目标源
 * @return HTTP请求处理器
 */
function redirectHandler(origin: string): OnRequestHandler {
	return (req, res) => res.writeHead(301, { Location: origin + req.url }).end()
}

/**
 * 将 Server.listen 转成异步方法并调用。
 *
 * @param server 服务器
 * @param port 端口
 * @param hostname 绑定的主机名
 */
function listenAsync(server: Server, port: number, hostname: string) {
	return new Promise<void>((resolve) => server.listen(port, hostname, resolve));
}

/**
 * 创建并启动一个或多个服务器，返回关闭它们的函数。
 *
 * @param handler 处理请求的函数
 * @param options 选项
 * @return 关闭创建的服务器的函数
 */
export default async function startServer(handler: OnRequestHandler, options: ServerOptions) {
	const { hostname = "localhost", connectors } = options;

	const servers: Server[] = [];
	const connections = new Set<Socket>();

	for (const connector of connectors) {
		const { redirect } = connector;
		const server = createConnector(connector);

		if (redirect) {
			server.on("request", redirectHandler(redirect));
		} else {
			server.on("request", handler);
		}

		// Server.close 方法不会立即断开 Keep-Alive 的连接，这会使程序延迟几分钟才能结束。
		// 这里手动记录下所有的链接，在服务器关闭时销毁它们来避免上述问题。
		server.on("connection", (socket: Socket) => {
			connections.add(socket);
			socket.on("close", () => connections.delete(socket));
		});

		servers.push(server);
		await listenAsync(server, connector.port, hostname);
	}

	return () => {
		servers.forEach((s) => s.close());
		connections.forEach((s) => s.destroy());
	}
}
