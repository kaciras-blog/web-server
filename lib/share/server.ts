import http, { IncomingMessage, ServerResponse } from "http";
import http2, { Http2ServerRequest, Http2ServerResponse } from "http2";
import fs from "fs-extra";
import log4js from "log4js";


// app.callback() 的定义，比较长不方便直接写在参数里
type OnRequestHandler = (req: IncomingMessage | Http2ServerRequest, res: ServerResponse | Http2ServerResponse) => void;

/**
 * 创建Http服务器。
 *
 * @param requestHandler 请求处理函数
 * @param options 选项
 */
export default function (requestHandler: OnRequestHandler, options: any) {
	const logger = log4js.getLogger("server");
	const httpPort = options.port || 80;
	const tlsPort = options.httpsPort || 443;

	if (options.tls) {
		http2.createSecureServer({
			key: fs.readFileSync(options.privatekey),
			cert: fs.readFileSync(options.certificate),
			allowHTTP1: true,
		}, requestHandler).listen(tlsPort);

		logger.info(`Https连接端口：${tlsPort}`);
	}

	if (options.redirectHttp) {
		http.createServer((req, res) => {
			res.writeHead(301, { "Location": "https://" + req.headers.host + req.url });
			res.end();
		}).listen(httpPort);
		logger.info(`重定向来自端口：${httpPort}的Http请求至端口：${tlsPort}`);
	} else {
		logger.info(`在端口：${httpPort}上监听Http连接`);
		return http.createServer(requestHandler).listen(httpPort);
	}
};
