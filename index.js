const log4js = require("log4js");
const config = require("./config");

function configureLog4js () {
	const logConfig = {
		appenders: {
			out: { type: "stdout" },
		},
		categories: {
			default: { appenders: ["out"], level: config.logLevel },
		},
	};
	if (config.fileLog) {
		logConfig.appenders.file = {
			type: "file",
			filename: "app.log",
			flags: "w",
			encoding: "utf-8",
		};
		logConfig.categories.default.appenders = ["file"];
	}
	log4js.configure(logConfig);
}

/**
 * 捕获全局异常，将其输出到Log4js中。
 */
function redirectSystemError () {
	const logger = log4js.getLogger("system");
	process.on("uncaughtException", err => logger.error(err));
}

configureLog4js();
redirectSystemError();

/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
 *							设置完日志之后再加载程序
 * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */

const fs = require("fs");
const http2 = require("http2");
const http = require("http");
const app = require("./lib/app");

const logger = log4js.getLogger("app");
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
