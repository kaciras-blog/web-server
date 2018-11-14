const log4js = require("log4js");
const config = require("./config");
const http2 = require("http2");

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

const axios = require("axios");

// 其它服务启用了HTTPS，并且对于内部调用证书的CN不是localhost，需要关闭证书检查
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

const path = require("path");
const appConfigLocation = process.argv[1];
let app;

if (appConfigLocation) {
	logger.info(`Startup development server with config ${appConfigLocation}.`);
	app = require(path.resolve(appConfigLocation));
} else {
	logger.info("No webpack config specified, run on production mode.");
	app = require("./lib/app");
	const send = require("koa-send");
	app.use(require("./lib/vuessr")());
	app.use(ctx => send(ctx, "index.html", { root: config.contentRoot, maxage: config.cacheMaxAge }));
}


/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
 *								  启动服务器
 * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */

const http = require("http");
const fs = require("fs");

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
