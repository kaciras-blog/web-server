import conditional from "koa-conditional-get";
import etag from "koa-etag";
import ServerAPI from "./ServerAPI";
import { CliServerPligun } from "./index";
import { createImageMiddleware, createSitemapMiddleware, ImageMiddlewareOptions, intercept } from "./middlewares";
import multer = require("koa-multer");
import cors, { Options as CorsOptions } from "@koa/cors";
import compress from "koa-compress";
import serve from "koa-static";


export interface AppOptions extends ImageMiddlewareOptions {
	cors?: CorsOptions;
	serverAddress: string;
	staticRoot: string;
}

export default class BlogPlugin implements CliServerPligun {

	private readonly options: AppOptions;

	constructor (options: AppOptions) {
		this.options = options;
	}

	configureCliServer (api: ServerAPI) {
		const { options } = this;

		const uploader = multer({ limits: { fileSize: 16 * 1024 * 1024 } });
		api.useBeforeAll(uploader.single("file"));
		api.useBeforeAll(conditional());
		api.useBeforeAll(cors(options.cors));

		api.useFilter(intercept([
			"/index.template.html",
			"/vue-ssr-client-manifest.json",
			"/vue-ssr-server-bundle.json",
		]));
		api.useFilter(compress({ threshold: 2048 }));
		api.useFilter(etag());

		api.useResource(serve(options.staticRoot, {
			index: false,
			maxage: 30 * 86400 * 1000,
		}));
		api.useResource(createImageMiddleware(options)); // 图片太大不计算etag
		api.useResource(createSitemapMiddleware(options.serverAddress));
	}
}
