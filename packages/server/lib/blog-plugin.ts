import Axios from "axios";
import { Context, Middleware } from "koa";
import { getLogger } from "log4js";
import conditional from "koa-conditional-get";
import cors from "@koa/cors";
import compress from "koa-compress";
import multer from "@koa/multer";
import bodyParser from "koa-bodyparser";
import compose from "koa-compose";
import { PreGenerateImageService } from "@kaciras-blog/image/lib/image-service";
import { localFileStore } from "@kaciras-blog/image/lib/image-store";
import installCSPPlugin from "./csp-plugin";
import { downloadImage, route, uploadImage } from "./image-middleware";
import { AppOptions } from "./options";
import { createSitemapMiddleware } from "./sitemap";
import { feedMiddleware } from "./feed";
import ApplicationBuilder, { FunctionCliServerPlugin } from "./ApplicationBuilder";
import { configureForProxy } from "./axios-helper";


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

function createImageMiddleware(options: AppOptions) {
	const service = new PreGenerateImageService(localFileStore(options.imageRoot));
	const url = options.serverAddress + "/session/user";

	const downloadFn: Middleware = (ctx) => downloadImage(service, ctx);
	let uploadFn: Middleware = (ctx) => uploadImage(service, ctx);

	// 限制上传用户，仅博主能上传。TODO: 支持评论插入图片
	const checkPermission: Middleware = async (ctx, next) => {
		const response = await Axios.get(url, configureForProxy(ctx));
		response.data.id === 2 ? await next() : (ctx.status = 403);
	};
	uploadFn = compose<Context>([checkPermission, uploadFn]);

	return route("/image", downloadFn, uploadFn);
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

		api.useResource(createImageMiddleware(options));
		api.useResource(serviceWorkerToggle(true));
		api.useResource(createSitemapMiddleware(options.serverAddress));
		api.useResource(feedMiddleware(options.serverAddress));
	};
}
