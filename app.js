const http2 = require("http2");
const http = require("http");
const Koa = require("koa");
const compress = require("koa-compress");
const serve = require("koa-static");
const etag = require("koa-etag");
const send = require("koa-send");
const conditional = require("koa-conditional-get");
const cors = require("@koa/cors");
const multer = require("koa-multer");
const fs = require("fs");
const log4js = require("log4js");
const config = require("./config");
const image = require("./image");


const app = new Koa();
const logger = log4js.getLogger("app");
logger.level = "info";

const uploader = multer({
	limits: config.image.maxSize,
});

app.use(cors(config.cors));
app.use(conditional());
app.use(uploader.single("file"));

// robots.txt 帮助爬虫抓取，并指向站点地图
app.use((ctx, next) => {
	if (ctx.request.path === "/robots.txt") {
		return send(ctx, "robots.txt");
	}
	return next();
});

app.use(require("./sitemap"));
app.use(image); // 图片太大不计算etag，也不需要二次压缩

app.use(compress({
	threshold: 2048,
}));
app.use(etag());

app.use(serve(config.content, {
	maxage: 30 * 86400 * 1000,
}));

app.use(require("./vuessr")());

// 单页应用，默认返回页面
app.use(ctx => send(ctx, "index.html", { root: config.content, maxage: 365 * 24 * 3600 * 1000 }));

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
