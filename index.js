const fs = require("fs");
const http2 = require("http2");
const http = require("http");
const config = require("./config");
const app = require("./app");

const logger = require("log4js").getLogger("app");
logger.level = "info";

if (config.tls) {
	const tlsPort = config.httpsPort || 443;
	const httpPort = config.port || 80;

	http2.createSecureServer({
		key: fs.readFileSync(config.privatekey),
		cert: fs.readFileSync(config.certificate),
		allowHTTP1: true,
	}, app.callback()).listen(tlsPort);

	// 创建重定向服务
	http.createServer((req, res) => {
		res.writeHead(301, { "Location": "https://" + req.headers.host + req.url });
		res.end();
	}).listen(httpPort);

	logger.info(`Https连接端口：${tlsPort}，并重定向来自端口${httpPort}的Http请求`);
} else {
	http.createServer(app.callback()).listen(config.port || 80);
	logger.info(`在端口：${config.port || 80}上监听Http连接`);
}
