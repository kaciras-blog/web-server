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
import { downloadImage, uploadImage } from "./koa/image";
import sitemapHandler from "./koa/sitemap";
import feedHandler from "./koa/feed";
import { downloadVideo, uploadVideo } from "./koa/video";
import { configureForProxy } from "./axios-helper";
import ApplicationBuilder, { FunctionPlugin } from "./ApplicationBuilder";
import { AppOptions } from "./options";

const logger = getLogger();

const CSP_REPORT_URI = "/csp-report";

/**
 * 设置 CSP 和 HSTS 头的中间件，能提高点安全性。
 *
 * 一些CSP指令在<meta>元素中无效，所以要在服务端配置。
 *
 * Content-Security-Policy：
 *   frame-ancestors: 没想出有什么嵌入其它网站的必要
 *   object-src: 禁止一些过时元素
 *   block-all-mixed-content: 我全站都是HTTPS，也不太会去用HTTP的服务
 *   其他的限制太死了，暂时没开启
 *
 * Strict-Transport-Security：直接设个最长时间就行，我的网站也不可能退回 HTTP
 *
 * TODO: 目前的配置比较简单就直接写死了，复杂了再考虑 koa-helmet
 */
async function securityFilter(ctx: BaseContext, next: Next) {
	await next();
	ctx.set("Strict-Transport-Security", "max-age=31536000; preload");
	ctx.set("Content-Security-Policy", "frame-ancestors 'self'; " +
		"object-src 'none'; block-all-mixed-content; report-uri " + CSP_REPORT_URI);
}

function cspReporter(ctx: ExtendableContext) {
	if (ctx.request.body) {
		logger.warn("CSP Violation: ", ctx.request.body);
	} else {
		logger.warn("CSP Violation: No data received!");
	}
	ctx.status = 204;
}

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
			origin: (ctx) => ctx.protocol + "://" + options.host,
			credentials: true,
			maxAge: 864000,
			exposeHeaders: ["Location"],
			allowHeaders: ["X-CSRF-Token"],
		}));

		api.useBeforeAll(conditional());
		api.useBeforeAll(bodyParser());
		api.useBeforeAll(securityFilter);

		const uploader = multer({ limits: { fileSize: 10 * 1024 * 1024 } });
		api.useBeforeAll(uploader.single("file"));

		api.useFilter(intercept(/^\/index\.template|vue-ssr/));

		// brotli 压缩慢，效率也就比 gzip 高一点，用在动态内容上不值得
		api.useFilter(compress({ br: false, threshold: 1024 }));

		const adminFilter = adminOnlyFilter(options.serverAddress);
		const router = new Router();

		router.get("/feed/:type", feedHandler(options.serverAddress));
		router.get("/sw-check", toggleSW(options.serviceWorker));
		router.get("/sitemap.xml", sitemapHandler(options.serverAddress));
		router.post(CSP_REPORT_URI, cspReporter);

		// 用 image-middleware 里的函数组合成图片处理中间件。
		// TODO: 支持评论插入图片
		const service = new PreGenerateImageService(localFileStore(options.dataDir));
		router.post("/image", adminFilter, (ctx: any) => uploadImage(service, ctx));
		router.get("/image/:name", ctx => downloadImage(service, ctx));

		const videoDir = path.join(options.dataDir, "video");
		fs.ensureDirSync(videoDir);
		router.post("/video", adminFilter, async (ctx: any) => uploadVideo(videoDir, ctx));
		router.get("/video/:name", ctx => downloadVideo(videoDir, ctx));

		api.useResource(router.routes());
	};
}
