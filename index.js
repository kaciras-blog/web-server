const fs = require("fs");
const http2 = require("http2");
const http = require("http");
const config = require("./config");
const app = require("./app");
const logger = require("log4js").getLogger("app");

logger.level = "info";
const httpPort = config.port || 80;

if (config.tls) {
	const tlsPort = config.httpsPort || 443;

	http2.createSecureServer({
		key: fs.readFileSync(config.privatekey),
		cert: fs.readFileSync(config.certificate),
		allowHTTP1: true,
	}, app.callback()).listen(tlsPort);

	logger.info(`Https连接端口：${tlsPort}`);
}

if (config.tls && config.redirectHttp) {
	// 创建重定向服务
	http.createServer((req, res) => {
		res.writeHead(301, { "Location": "https://" + req.headers.host + req.url });
		res.end();
	}).listen(httpPort);
	logger.info(`重定向来自端口${httpPort}的Http请求至Https`);
} else {
	http.createServer(app.callback()).listen(httpPort);
	logger.info(`在端口：${httpPort}上监听Http连接`);
}
