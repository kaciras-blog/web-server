import http2, { IncomingHttpHeaders, IncomingHttpStatusHeader } from "http2";
import axios from "axios";
import Koa from "koa";
import { intercept } from "../share/koa-middleware";
import createServer from "../share/server";
import { configureWebpack, devMiddleware, prodMiddleware } from "./vue-ssr";
import dev from "./dev";
import log4js from "log4js";
import blogPlugin from "./blog";

const compress = require("koa-compress");
const serve = require("koa-static");
const etag = require("koa-etag");
const conditional = require("koa-conditional-get");
const cors = require("@koa/cors");
const multer = require("koa-multer");


const logger = log4js.getLogger("app");

// 其它服务启用了HTTPS，但对于内部调用来说证书的CN不是localhost，需要关闭证书检查
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

/**
 * 修改Axios使其支持内置http2模块
 */
function adaptAxiosHttp2() {

	function request(options: any, callback: any) {
		let host = `https://${options.hostname}`;
		if (options.port) {
			host += ":" + options.port;
		}

		const client = http2.connect(host);
		const req: any = client.request({
			...options.headers,
			":method": options.method.toUpperCase(),
			":path": options.path,
		});

		req.on("response", (headers: IncomingHttpHeaders & IncomingHttpStatusHeader) => {
			req.headers = headers;
			req.statusCode = headers[":status"];
			callback(req);
		});
		req.on("end", () => client.close());
		return req;
	}

	// 修改Axios默认的transport属性，注意该属性是内部使用没有定义在接口里
	(<any>axios.defaults).transport = { request };
}

function setupBasicMiddlewares(app: Koa, options: any) {
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

export default async function (options: any, _devserver: boolean /* 临时 */) {
	adaptAxiosHttp2();
	const app = new Koa();

	if (_devserver) {
		const clientConfig = require("../template/client.config").default(options.webpack);
		configureWebpack(clientConfig);
		const middleware = await dev(options, clientConfig);

		app.use(middleware); // 这个得放在koa-compress前头。
		setupBasicMiddlewares(app, options);
		app.use(await devMiddleware(options));
	} else {
		logger.info("No webpack config specified, run as production mode.");

		setupBasicMiddlewares(app, options);
		app.use(prodMiddleware(options));
	}

	await createServer(app.callback(), options.server);
};
