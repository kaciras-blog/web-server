const Koa = require("koa");
const compress = require("koa-compress");
const serve = require("koa-static");
const etag = require("koa-etag");
const send = require("koa-send");
const conditional = require("koa-conditional-get");
const cors = require("@koa/cors");
const multer = require("koa-multer");
const image = require("./image");
const config = require("../config");
const path = require("path");


const logger = require("log4js").getLogger("app");

/**
 * 能够发送一个位于网站内容目录下的静态文件。
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
		if (ctx.method !== "GET") {
			ctx.status = 405;
			return Promise.resolve();
		}
		return send(ctx, path, { root: config.contentRoot });
	};
}

/**
 * 拦截文件，请求Path包含在列表中将返回404。
 *
 * @param files {string[]} 文件列表
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

function setupBasicMiddlewares (app) {
	app.use(cors(config.cors));
	app.use(conditional());

	// 图片太大不计算etag，也不需要二次压缩所以放得靠前
	const uploader = multer({ limits: 16 * 1024 * 1024 });
	app.use(uploader.single("file"));
	app.use(image());

	app.use(compress({ threshold: 2048 }));
	app.use(require("./sitemap")()); 	// robots.txt 帮助爬虫抓取，并指向站点地图

	app.use(etag());
	app.use(intercept([
		"/index.template.html",
		"/vue-ssr-client-manifest.json",
		"/vue-ssr-server-bundle.json",
	]));

	app.use(serve(config.contentRoot, {
		index: false,
		maxage: 30 * 86400 * 1000,
	}));
}

module.exports = async function (server) {
	const app = new Koa();
	const dev = process.argv.indexOf("-dev");

	if (dev > 0) {
		const appConfigLocation = process.argv[dev + 1];
		logger.info(`Startup development server with config ${appConfigLocation}.`);

		const clientConfig = require(path.resolve(appConfigLocation, "client.config.js"));
		const serverConfig = require(path.resolve(appConfigLocation, "server.config.js"));
		const { middleware, renderFunctionFactory } = await require("./dev")(clientConfig, serverConfig);

		app.use(middleware); // 这个得放在koa-compress前头。
		setupBasicMiddlewares(app);

		app.use(require("./ssr")({ renderFunctionFactory }));
		app.use(async ctx => {
			const filename = path.join(clientConfig.output.path, "index.html");
			ctx.response.type = "html";
			ctx.response.body = middleware.devMiddleware.fileSystem.createReadStream(filename);
		});
	} else {
		logger.info("No webpack config specified, run as production mode.");

		setupBasicMiddlewares(app);
		app.use(require("./ssr")());
		app.use(ctx => send(ctx, "index.html", { root: config.contentRoot, maxage: config.cacheMaxAge }));
	}

	server.on("request", app.callback());
};
