const Koa = require("koa");
const compress = require("koa-compress");
const serve = require("koa-static");
const etag = require("koa-etag");
const conditional = require("koa-conditional-get");
const cors = require("@koa/cors");
const multer = require("koa-multer");
const image = require("../image");
const ssr = require("../ssr");
const { createServer } = require("../utils");


async function setupServer (app, options) {
	/**
	 * 拦截文件，请求Path包含在列表中将返回404。
	 *
	 * @param files {string[]} 文件列表
	 * @return {Function} Koa的中间件函数
	 */
	function intercept (files) {
		return function (ctx, next) {
			if (!files.includes(ctx.path)) {
				return next();
			}
			ctx.status = 404;
			return Promise.resolve();
		};
	}

	app.use(cors(options.cors));
	app.use(conditional());

	// 图片太大不计算etag，也不需要二次压缩所以放得靠前
	const uploader = multer({ limits: 16 * 1024 * 1024 });
	app.use(uploader.single("file"));
	app.use(image(options));

	app.use(compress({ threshold: 2048 }));
	app.use(require("../sitemap")(options)); // robots.txt 帮助爬虫抓取，并指向站点地图

	app.use(etag());
	app.use(intercept([
		"/index.template.html",
		"/vue-ssr-client-manifest.json",
		"/vue-ssr-server-bundle.json",
	]));

	app.use(serve(options.contentRoot, {
		index: false,
		maxage: 30 * 86400 * 1000,
	}));
	app.use(ssr(options));
}

async function start (api, args) {
	const app = new Koa();
	api.serverPlugin.forEach(plugin => plugin.setupFunc(app));
	createServer().on("request", app.callback());
}

module.exports = function (api, options) {
	api.addCommand("service", args => start(api, args));
	api.addServerPlugin(0, app => setupServer(app, options));
};
