const http2 = require("http2");
const http = require("http");
const fs = require("fs-extra");


module.exports.createServer = function (requestHandler, options) {
	const logger = require("log4js").getLogger("server");
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
