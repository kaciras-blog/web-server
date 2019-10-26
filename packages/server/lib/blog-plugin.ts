import { Middleware } from "koa";
import { getLogger } from "log4js";
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


const logger = getLogger();

/**
 * 前端页面是否注册 ServiceWorker 的检查点，该URI返回200状态码时表示注册，否则应当注销。
 *
 * @param register 是否注册 ServiceWorker
 */
export function serviceWorkerToggle(register: boolean): Middleware {
	return (ctx, next) => {
		if (ctx.path !== "/sw-check") {
			return next();
		}
		ctx.status = register ? 200 : 205;
		ctx.flushHeaders();
	};
}

/**
 * 拦截文件，path匹配到任一模式串的请求将返回404。
 *
 * @param patterns 匹配被拦截文件路径的模式串
 * @return Koa 的中间件函数
 */
export function intercept(patterns: RegExp | RegExp[]): Middleware {

	const combined = Array.isArray(patterns)
		? new RegExp(patterns.map((p) => `(?:${p.source})`).join("|"))
		: patterns;

	return (ctx, next) => {
		if (!combined.test(ctx.path)) {
			return next();
		}
		ctx.status = 404;
		logger.debug(`客户端请求了被拦截的文件：${ctx.url}`);
	};
}

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
