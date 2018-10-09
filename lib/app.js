const Koa = require("koa");
const compress = require("koa-compress");
const serve = require("koa-static");
const etag = require("koa-etag");
const send = require("koa-send");
const conditional = require("koa-conditional-get");
const cors = require("@koa/cors");
const multer = require("koa-multer");
const config = require("../config");
const image = require("./image");


/**
 * 能够发送一个位于网站内容目录下的文件。
 *
 * @param path 文件路径，是URL中的path部分，以/开头
 * @return {Function} 中间件函数
 */
function staticFile (path) {
	if (path.startsWith("/static/")) {
		throw new Error("静态文件目录请用 koa-static 处理");
	}
	return function (ctx, next) {
		if (ctx.path !== path) {
			return next();
		}
		if (ctx.method !== "GET") { // 静态文件仅支持GET
			ctx.status = 405;
			return Promise.resolve();
		}
		return send(ctx, path, { root: config.content });
	};
}

const app = new Koa();
const uploader = multer({
	limits: config.image.maxSize,
});

app.use(cors(config.cors));
app.use(conditional());
app.use(uploader.single("file"));

app.use(image); // 图片太大不计算etag，也不需要二次压缩
app.use(staticFile("/service-worker.js"));
app.use(staticFile("/robots.txt")); // robots.txt 帮助爬虫抓取，并指向站点地图

app.use(compress({
	threshold: 2048,
}));

app.use(require("./sitemap"));
app.use(etag());

// 仅允许/static/开头的请求访问静态资源，避免发送dist目录下的文件
const staticMiddleware = serve(config.content, {
	index: false,
	maxage: 30 * 86400 * 1000,
});
app.use((ctx, next) => {
	if (ctx.path.startsWith("/static/")) {
		return staticMiddleware(ctx, next);
	}
	return next();
});

app.use(require("./vuessr")());

// 单页应用，默认返回页面
app.use(ctx => send(ctx, "index.html", { root: config.content, maxage: 365 * 24 * 3600 * 1000 }));

module.exports = app;
