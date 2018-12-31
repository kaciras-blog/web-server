import { configureWebpack, devMiddleware, prodMiddleware } from "cli-plugin-vue";
import Koa from "koa";
import log4js from "log4js";
import dev from "../cli-core/plugins/dev";
import blogPlugin from "../kaciras-blog";
import { intercept } from "./middleware";
import createServer from "./server";

const compress = require("koa-compress");
const serve = require("koa-static");
const etag = require("koa-etag");
const conditional = require("koa-conditional-get");
const cors = require("@koa/cors");
const multer = require("koa-multer");


const logger = log4js.getLogger("app");

// 其它服务启用了HTTPS，但对于内部调用来说证书的CN不是localhost，需要关闭证书检查
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";


function setupBasicMiddlewares (app: Koa, options: any) {
	app.use(cors(options.blog.cors));
	app.use(conditional());

	const uploader = multer({ limits: 16 * 1024 * 1024 });
	app.use(uploader.single("file"));

	app.use(compress({ threshold: 2048 }));
	blogPlugin(app, options.blog); // 图片太大不计算etag

	app.use(etag());
	app.use(intercept([
		"/index.template.html",
		"/vue-ssr-client-manifest.json",
		"/vue-ssr-server-bundle.json",
	]));

	app.use(serve(options.webpack.outputPath, {
		index: false,
		maxage: 30 * 86400 * 1000,
	}));
}

export default async function (options: any, devserver: boolean /* 临时 */) {
	const app = new Koa();

	if (devserver) {
		const clientConfig = require("../cli-core/template/client.config").default(options.webpack);
		configureWebpack(clientConfig);
		const middleware = await dev(options, clientConfig);

		app.use(middleware); // 这个得放在koa-compress前头。
		setupBasicMiddlewares(app, options);
		app.use(await devMiddleware(options));
	} else {
		logger.info("No webpack config specified, run as production mode.");

		setupBasicMiddlewares(app, options);
		app.use(await prodMiddleware(options));
	}

	await createServer(app.callback(), options.server);
}
