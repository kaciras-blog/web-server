const http2 = require("http2");
const axios = require("axios");
const Koa = require("koa");
const compress = require("koa-compress");
const serve = require("koa-static");
const etag = require("koa-etag");
const send = require("koa-send");
const conditional = require("koa-conditional-get");
const cors = require("@koa/cors");
const multer = require("koa-multer");
const image = require("./image");
const path = require("path");
const ssr = require("./ssr");
const { createServer } = require("./utils");
const config = require(process.env.development ? "../config" : "../config.production");


const logger = require("log4js").getLogger("app");

// 其它服务启用了HTTPS，但对于内部调用来说证书的CN不是localhost，需要关闭证书检查
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

/**
 * 修改Axios使其支持内置http2模块
 */
function adaptAxiosHttp2 () {
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
}

/**
 * 能够发送一个位于网站内容目录下的静态文件。
 *
 * @param path 文件路径，是URL中的path部分，以/开头
 * @param options {Object} 选项
 * @return {Function} 中间件函数
 */
function staticFile (path, options) {
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
		return send(ctx, path, { root: options.contentRoot });
	};
}

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

function setupBasicMiddlewares (app, options) {
	app.use(cors(options.cors));
	app.use(conditional());

	// 图片太大不计算etag，也不需要二次压缩所以放得靠前
	const uploader = multer({ limits: 16 * 1024 * 1024 });
	app.use(uploader.single("file"));
	app.use(image(options));

	app.use(compress({ threshold: 2048 }));
	app.use(require("./sitemap")(options)); // robots.txt 帮助爬虫抓取，并指向站点地图

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
}

async function startup (server, options) {
	const app = new Koa();
	const dev = process.argv.indexOf("-dev");

	if (dev > 0) {
		const appConfigLocation = process.argv[dev + 1];
		logger.info(`Startup development server with config ${appConfigLocation}.`);

		const { middleware, renderFunctionFactory } = await require("./plugins/dev")({
			clientConfig: path.resolve(appConfigLocation, "webpack/client.config"),
			serverConfig: path.resolve(appConfigLocation, "webpack/server.config"),
			configFile: require(path.resolve(appConfigLocation, "config.dev")),
			template: "D:\\Project\\Blog\\WebContent\\public\\index.template.html",
		});

		app.use(middleware); // 这个得放在koa-compress前头。
		setupBasicMiddlewares(app, options);

		options.renderFunctionFactory = renderFunctionFactory;
		app.use(ssr(options));
	} else {
		logger.info("No webpack config specified, run as production mode.");

		setupBasicMiddlewares(app, options);
		app.use(ssr(options));
	}

	server.on("request", app.callback());
}


/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
 *								启动Http服务器
 * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */

module.exports = async function () {
	adaptAxiosHttp2();
	const server = await createServer(config.server);
	await startup(server, config);
};
