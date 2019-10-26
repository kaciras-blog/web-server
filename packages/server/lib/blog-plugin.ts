import conditional from "koa-conditional-get";
import cors from "@koa/cors";
import compress from "koa-compress";
import multer from "@koa/multer";
import { PreGenerateImageService } from "@kaciras-blog/image/lib/image-service";
import { localFileStore } from "@kaciras-blog/image/lib/image-store";
import bodyParser from "koa-bodyparser";
import installCSPPlugin from "./csp-plugin";
import { imageMiddleware } from "./image-middleware";
import { AppOptions } from "./options";
import { createSitemapMiddleware } from "./sitemap";
import { feedMiddleware } from "./feed";
import ApplicationBuilder, { FunctionCliServerPlugin } from "./ApplicationBuilder";
import { intercept, serviceWorkerToggle } from "./middlewares";


// 【注意】没有使用 Etag，因为所有资源都可以用时间缓存，而且 koa-etag 内部使用 sha1 计算 Etag，
// 对于图片这样较大的资源会占用 CPU，而我的VPS处理器又很垃圾。
export default function getBlogPlugin(options: AppOptions): FunctionCliServerPlugin {

	return (api: ApplicationBuilder) => {
		api.useBeforeAll(conditional());
		api.useBeforeAll(cors(options.cors));
		api.useBeforeAll(bodyParser());

		const uploader = multer({ limits: { fileSize: 4 * 1024 * 1024 } });
		api.useBeforeAll(uploader.single("file"));

		installCSPPlugin(api);

		api.useFilter(intercept([
			/\.(?:js|css)\.map$/,
			/^\/index\.template|vue-ssr/,
		]));
		api.useFilter(compress({ threshold: 1024 }));

		api.useResource(imageMiddleware({
			service: new PreGenerateImageService(localFileStore(options.imageRoot)),
			apiServer: options.serverAddress,
		}));
		api.useResource(serviceWorkerToggle(true));
		api.useResource(createSitemapMiddleware(options.serverAddress));
		api.useResource(feedMiddleware(options.serverAddress));
	};
}
