const http2 = require("http2");
const axios = require("axios");
const Koa = require("koa");
const compress = require("koa-compress");
const serve = require("koa-static");
const etag = require("koa-etag");
const conditional = require("koa-conditional-get");
const cors = require("@koa/cors");
const multer = require("koa-multer");
const image = require("./image");
const path = require("path");
const ssr = require("./ssr");
const { createServer } = require("./utils");
const { intercept } = require("./share/koa-middleware");


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


function setupBasicMiddlewares (app, options) {
	app.use(cors(options.cors));
	app.use(conditional());

	// 图片太大不计算etag，也不需要二次压缩所以放得靠前
	const uploader = multer({ limits: 16 * 1024 * 1024 });
	app.use(uploader.single("file"));
	app.use(image(options));

	app.use(compress({ threshold: 8192 }));
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

async function startup (options) {
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

	return app;
}


/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
 *								启动Http服务器
 * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */

module.exports = async function (options) {
	adaptAxiosHttp2();
	const app = await startup(options);
	await createServer(app, options.server);
};
