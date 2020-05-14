import fs from "fs-extra";
import path from "path";
import Axios from "axios";
import { BaseContext, ExtendableContext, Next } from "koa";
import { getLogger } from "log4js";
import conditional from "koa-conditional-get";
import cors from "@koa/cors";
import compress from "koa-compress";
import multer from "@koa/multer";
import Router from "@koa/router";
import bodyParser from "koa-bodyparser";
import { PreGenerateImageService } from "@kaciras-blog/image/lib/image-service";
import { localFileStore } from "@kaciras-blog/image/lib/image-store";
import installCSPPlugin from "./csp-plugin";
import { downloadImage, uploadImage } from "./image-middleware";
import sitemapHandler from "./sitemap";
import feedHandler from "./feed";
import { configureForProxy } from "./axios-helper";
import ApplicationBuilder, { FunctionPlugin } from "./ApplicationBuilder";
import { AppOptions } from "./options";
import { downloadVideo, uploadVideo } from "./video-middleware";


const logger = getLogger();

/**
 * 前端页面是否注册 ServiceWorker 的检查点，该URI返回200状态码时表示注册，否则应当注销。
 *
 * @param enable 是否注册 ServiceWorker
 */
export function toggleSW(enable?: boolean) {
	return (ctx: BaseContext) => {
		ctx.status = enable ? 200 : 205;
		ctx.flushHeaders();
	};
}

/**
 * 拦截某些资源，ctx.path 匹配到任一模式串的请求将被拦截，并返回404。
 *
 * @param patterns 模式串
 * @return Koa 的中间件函数
 */
export function intercept(patterns: RegExp | RegExp[]) {

	const combined = Array.isArray(patterns)
		? new RegExp(patterns.map((p) => `(?:${p.source})`).join("|"))
		: patterns;

	return (ctx: BaseContext, next: Next) => {
		if (!combined.test(ctx.path)) {
			return next();
		}
		ctx.status = 404;
		logger.debug(`客户端请求了被拦截的文件：${ctx.url}`);
	};
}

/**
 * 限制后面的中间件只能由管理员访问。
 *
 * @param host 内容服务器地址
 * @return 拦截中间件
 */
export function adminOnlyFilter(host: string) {
	const url = host + "/session/user";

	return async (ctx: ExtendableContext, next: Next) => {
		const { data } = await Axios.get(url, configureForProxy(ctx));
		return data.id === 2 ? next() : (ctx.status = 403);
	}
}

// 【注意】没有使用 Etag，因为所有资源都可以用时间缓存，而且 koa-etag 内部使用 sha1 计算 Etag，
// 对于图片这样较大的资源会占用 CPU，而我的VPS处理器又很垃圾。
export default function getBlogPlugin(options: AppOptions): FunctionPlugin {

	return (api: ApplicationBuilder) => {
		api.useBeforeAll(cors({
			origin: (ctx) => ctx.protocol + options.host,
			credentials: true,
			maxAge: 864000,
			exposeHeaders: ["Location"],
			allowHeaders: ["X-CSRF-Token"],
		}));

		api.useBeforeAll(conditional());
		api.useBeforeAll(bodyParser());

		const uploader = multer({ limits: { fileSize: 10 * 1024 * 1024 } });
		api.useBeforeAll(uploader.single("file"));

		installCSPPlugin(api);
		api.useFilter(intercept(/^\/index\.template|vue-ssr/));

		// brotli 压缩慢，效率也就比 gzip 高一点，用在动态内容上不值得
		// @ts-ignore TODO: 类型定义没跟上版本
		api.useFilter(compress({ br: false, threshold: 1024, }));

		const adminFilter = adminOnlyFilter(options.serverAddress);
		const router = new Router();

		router.get("/feed/:type", feedHandler(options.serverAddress));
		router.get("/sw-check", toggleSW(options.serviceWorker));
		router.get("/sitemap.xml", sitemapHandler(options.serverAddress));

		// 用 image-middleware 里的函数组合成图片处理中间件。
		// TODO: 支持评论插入图片
		const service = new PreGenerateImageService(localFileStore(options.dataDir));
		router.post("/image", adminFilter, (ctx: any) => uploadImage(service, ctx));
		router.get("/image/:name", ctx => downloadImage(service, ctx));

		const videoDir = path.join(options.dataDir, "video");
		fs.ensureDirSync(videoDir);
		router.get("/video/:name", ctx => downloadVideo(videoDir, ctx));
		router.post("/video", adminFilter, async (ctx: any) => uploadVideo(videoDir, ctx));

		api.useResource(router.routes());
	};
}
