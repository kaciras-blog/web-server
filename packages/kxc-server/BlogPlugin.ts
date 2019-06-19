import cors, { Options as CorsOptions } from "@koa/cors";
import compress from "koa-compress";
import conditional from "koa-conditional-get";
import etag from "koa-etag";
import { createImageMiddleware, ImageMiddlewareOptions } from "./image-store";
import ServerAPI, { ClassCliServerPligun } from "./infra/ServerAPI";
import { intercept, serviceWorkerToggle } from "./infra/middlewares";
import { createSitemapMiddleware } from "./sitemap";
import multer = require("koa-multer");
import bodyParser from "koa-bodyparser";
import installCSPPlugin from "./csp-plugin";


export interface AppOptions extends ImageMiddlewareOptions {
	cors?: CorsOptions;

	serverAddress: string;
	https?: boolean;
	serverCert: string | true;
}

export default class BlogPlugin implements ClassCliServerPligun {

	private readonly options: AppOptions;

	constructor(options: AppOptions) {
		this.options = options;
	}

	configureCliServer(api: ServerAPI) {
		const { options } = this;
		installCSPPlugin(api);

		api.useBeforeAll(conditional());
		api.useBeforeAll(cors(options.cors));
		api.useBeforeAll(bodyParser());

		const uploader = multer({ limits: { fileSize: 4 * 1024 * 1024 } });
		api.useBeforeAll(uploader.single("file"));

		api.useBeforeFilter(serviceWorkerToggle(true));
		api.useBeforeFilter(createImageMiddleware(options)); // 图片太大不计算etag

		api.useFilter(intercept([
			/\.(?:js|css)\.map$/,
			/^\/index\.template|vue-ssr/,
		]));
		api.useFilter(compress({ threshold: 1024 }));
		api.useFilter(etag());

		api.useResource(createSitemapMiddleware(options.serverAddress));
	}
}
