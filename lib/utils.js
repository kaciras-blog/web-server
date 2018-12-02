const fs = require("fs");
const http2 = require("http2");
const http = require("http");


/**
 * Node的 fs API 里没有很方便的判断文件存在并返回bool类型的函数，这里封装一个。
 *
 * @param path {string} 路径
 * @return {Promise<boolean>} 如果存在将返回true，否则false
 */
module.exports.fileExist = function (path) {
	return fs.promises.access(path).then(() => true).catch(() => false);
};

module.exports.createServer = function (options) {
	const logger = require("log4js").getLogger("server");
	const httpPort = options.port || 80;
	const tlsPort = options.httpsPort || 443;

	if (options.tls) {
		const server = http2.createSecureServer({
			key: fs.readFileSync(options.privatekey),
			cert: fs.readFileSync(options.certificate),
			allowHTTP1: true,
			// settings: { enableConnectProtocol: true },
		}).listen(tlsPort);

		// 创建重定向服务
		if (options.redirectHttp) {
			http.createServer((req, res) => {
				res.writeHead(301, { "Location": "https://" + req.headers.host + req.url });
				res.end();
			}).listen(httpPort);
			logger.info(`重定向来自端口：${httpPort}的Http请求至端口：${tlsPort}`);
		}

		logger.info(`Https连接端口：${tlsPort}`);
		return server;
	} else {
		logger.info(`在端口：${httpPort}上监听Http连接`);
		return http.createServer().listen(httpPort);
	}
};
