import cors, { Options as CorsOptions } from "@koa/cors";
import compress from "koa-compress";
import conditional from "koa-conditional-get";
import etag from "koa-etag";
import { createImageMiddleware } from "./image-service";
import ServerAPI, { ClassCliServerPligun } from "./ServerAPI";
import { intercept, serviceWorkerToggle } from "./middlewares";
import { createSitemapMiddleware } from "./sitemap";
import multer from "koa-multer";
import bodyParser from "koa-bodyparser";
import installCSPPlugin from "./csp-plugin";
import { LocalImageStore } from "./image-converter";


/** 对应配置的 blog 属性 */
export interface AppOptions {
	imageRoot: string;
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
		api.useBeforeFilter(createImageMiddleware(new LocalImageStore(options.imageRoot)));

		api.useFilter(intercept([
			/\.(?:js|css)\.map$/,
			/^\/index\.template|vue-ssr/,
		]));
		api.useFilter(compress({ threshold: 1024 }));
		api.useFilter(etag());  // 图片太大不计算etag

		api.useResource(createSitemapMiddleware(options.serverAddress));
	}
}
