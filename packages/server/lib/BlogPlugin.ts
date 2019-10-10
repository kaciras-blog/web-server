import cors from "@koa/cors";
import compress from "koa-compress";
import conditional from "koa-conditional-get";
import etag from "koa-etag";
import ServerAPI, { ClassCliServerPlugin } from "./ServerAPI";
import { intercept, serviceWorkerToggle } from "./middlewares";
import { createSitemapMiddleware } from "./sitemap";
import { feedMiddleware } from "./feed";
import multer from "@koa/multer";
import bodyParser from "koa-bodyparser";
import installCSPPlugin from "./csp-plugin";
import { imageMiddleware } from "./image-middleware";
import { AppOptions } from "./options";
import { localFileStore } from "./image-store";
import { PreGenerateImageService } from "./image-service";


export default class BlogPlugin implements ClassCliServerPlugin {

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

		api.useBeforeFilter(imageMiddleware({
			service: new PreGenerateImageService(localFileStore(options.imageRoot)),
			apiServer: options.serverAddress,
		}));

		api.useBeforeFilter(serviceWorkerToggle(true));

		api.useFilter(intercept([
			/\.(?:js|css)\.map$/,
			/^\/index\.template|vue-ssr/,
		]));
		api.useFilter(compress({ threshold: 1024 }));
		api.useFilter(etag());  // 图片太大不计算etag

		api.useResource(createSitemapMiddleware(options.serverAddress));
		api.useResource(feedMiddleware(options.serverAddress));
	}
}