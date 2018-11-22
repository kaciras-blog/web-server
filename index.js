#!/usr/bin/env node
const log4js = require("log4js");
const config = require("./config");
const http2 = require("http2");
const http = require("http");
const fs = require("fs");
const axios = require("axios");
const startup = require("./lib/app");


/**
 * 配置日志功能，先于其他模块执行保证日志系统的完整。
 */
function configureLog4js () {
	const logConfig = {
		appenders: {
			console: {
				type: "stdout",
				layout: {
					type: "pattern",
					pattern: "%[%d{yyyy-MM-dd hh:mm:ss} [%p] %c - %]%m",
				},
			},
		},
		categories: {
			default: { appenders: ["console"], level: config.logLevel },
		},
	};
	if (config.fileLog) {
		logConfig.appenders.file = {
			type: "file",
			filename: "app.log",
			flags: "w",
			encoding: "utf-8",
			layout: {
				type: "pattern",
				pattern: "%d{yyyy-MM-dd hh:mm:ss} [%p] %c - %m",
			},
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
	process.on("uncaughtException", err => logger.error(err.message, err.stack));
}

redirectSystemError();
configureLog4js();
const logger = log4js.getLogger("app");


/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
 *						修改Axios使其支持内置http2模块
 * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */

// 其它服务启用了HTTPS，但对于内部调用来说证书的CN不是localhost，需要关闭证书检查
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

function request (options, callback) {
	let host = `https://${options.hostname}`;
	if (options.port) {
		host += ":" + options.port;
	}

	const client = http2.connect(host);
	const req = client.request({
		...options.headers,
		":method": options.method.toUpperCase(),
		":path": options.path,
	});

	req.on("response", headers => {
		req.headers = headers;
		req.statusCode = headers[":status"];
		callback(req);
	});
	req.on("end", () => client.close());
	return req;
}

// Axios发送Http2请求
axios.defaults.transport = { request };


/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
 *							设置完日志之后再加载程序
 * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */

async function createServer (options) {
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
}

async function start () {
	const server = await createServer(config.server);
	await startup(server, config);
}

start().then(() => logger.info("Startup complete."));
