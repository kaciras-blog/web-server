import cors, { Options as CorsOptions } from "@koa/cors";
import compress from "koa-compress";
import conditional from "koa-conditional-get";
import etag from "koa-etag";
import serve from "koa-static";
import { createImageMiddleware, ImageMiddlewareOptions } from "./image-store";
import ServerAPI, { ClassCliServerPligun } from "./infra/ServerAPI";
import { intercept, serviceWorkerToggle } from "./infra/middlewares";
import { createSitemapMiddleware } from "./sitemap";
import multer = require("koa-multer");


export interface AppOptions extends ImageMiddlewareOptions {
	cors?: CorsOptions;
	serverAddress: string;
	serverCert: string;
	staticRoot: string;
}

export default class BlogPlugin implements ClassCliServerPligun {

	private readonly options: AppOptions;

	constructor(options: AppOptions) {
		this.options = options;
	}

	configureCliServer(api: ServerAPI) {
		const { options } = this;

		const uploader = multer({ limits: { fileSize: 16 * 1024 * 1024 } });
		api.useBeforeAll(uploader.single("file"));
		api.useBeforeAll(conditional());
		api.useBeforeAll(cors(options.cors));

		api.useBeforeFilter(serviceWorkerToggle(true));
		api.useBeforeFilter(createImageMiddleware(options)); // 图片太大不计算etag

		api.useFilter(intercept([
			new RegExp("^/(?:index\\.template|vue-ssr)"),
			new RegExp("\\.(?:js|css)\\.map$"),
		]));
		api.useFilter(compress({ threshold: 2048 }));
		api.useFilter(etag());

		api.useResource(serve(options.staticRoot, {
			index: false,
			maxAge: 31536000,
		}));
		api.useResource(createSitemapMiddleware(options.serverAddress));
	}
}
