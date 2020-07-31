import fs from "fs-extra";
import path from "path";
import Axios from "axios";
import { getLogger } from "log4js";
import { BaseContext, ExtendableContext, Next } from "koa";
import conditional from "koa-conditional-get";
import compress from "koa-compress";
import multer from "@koa/multer";
import Router from "@koa/router";
import bodyParser from "koa-bodyparser";
import { PreGenerateImageService } from "@kaciras-blog/image/lib/image-service";
import { localFileStore } from "@kaciras-blog/image/lib/image-store";
import AppBuilder, { FunctionPlugin } from "./AppBuilder";
import { BlogServerOptions } from "./options";
import { downloadImage, uploadImage } from "./koa/image";
import sitemapHandler from "./koa/sitemap";
import feedHandler from "./koa/feed";
import { downloadFile, uploadFile } from "./koa/filestore";
import { configureForProxy } from "./axios-helper";

const logger = getLogger();

const CSP_REPORT_URI = "/csp-report";

/**
 * 设置 CSP 头的中间件，能提高点安全性。一些指令在 <meta> 元素中无效，所以要在服务端配置。
 *
 * 【Content-Security-Policy】
 * frame-ancestors: 没想出有什么嵌入其它网站的必要
 * object-src: 禁止一些过时元素
 * block-all-mixed-content: 我全站都是HTTPS，也不太会去用HTTP的服务
 * 其他的限制太死了，暂时没开启
 *
 * 【HSTS】
 * HSTS纯粹是跟底层TLS相关的头，不应该在这里配置，而且在localhost下会弹出一大堆警告。
 *
 * TODO: 目前的配置比较简单就直接写死了，复杂了再考虑 koa-helmet
 */
async function securityFilter(ctx: BaseContext, next: Next) {
	await next();
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
 * @param pattern 模式串，可以用 combineRegexOr 来组合多个串
 * @return Koa 的中间件函数
 */
export function intercept(pattern: RegExp) {
	return (ctx: BaseContext, next: Next) => {
		if (!pattern.test(ctx.path)) {
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

/*
 * 【关于 koa-etag】
 * 没有使用，因为所有资源都可以用时间缓存，而且 koa-etag 内部使用 sha1 计算 Etag，
 * 对于图片这样较大的资源会占用 CPU，而我的VPS处理器又很垃圾。
 */
export default function getBlogPlugin(options: BlogServerOptions): FunctionPlugin {
	const address = options.contentServer.internalOrigin;
	const { app } = options;

	return (api: AppBuilder) => {
		api.useBeforeAll(conditional());
		api.useBeforeAll(bodyParser());
		api.useBeforeAll(securityFilter);

		api.useFilter(intercept(/^\/index\.template|vue-ssr/));

		// brotli 压缩慢，效率也就比 gzip 高一点，用在动态内容上不值得
		api.useFilter(compress({ br: false, threshold: 1024 }));

		const adminFilter = adminOnlyFilter(address);
		const router = new Router();

		router.get("/feed/:type", feedHandler(options));
		router.get("/sw-check", toggleSW(app.serviceWorker));
		router.get("/sitemap.xml", sitemapHandler(address));
		router.post(CSP_REPORT_URI, cspReporter);

		// 过大的媒体建议直接传到第三方存储
		const multerInstance = multer({ limits: { fileSize: 50 * 1024 * 1024 } });
		const uploader = multerInstance.single("file");

		// 用 image-middleware 里的函数组合成图片处理中间件。
		// TODO: 支持评论插入图片
		const service = new PreGenerateImageService(localFileStore(app.dataDir));
		router.get("/image/:name", ctx => downloadImage(service, ctx));

		// @ts-ignore
		router.post("/image", adminFilter, uploader, (ctx: any) => uploadImage(service, ctx));

		const videoDir = path.join(app.dataDir, "video");
		fs.ensureDirSync(videoDir);
		router.get("/video/:name", ctx => downloadFile(videoDir, ctx));

		// @ts-ignore
		router.post("/video", adminFilter, uploader, (ctx: any) => uploadFile(videoDir, ctx));

		const audioDir = path.join(app.dataDir, "audio");
		fs.ensureDirSync(audioDir);
		router.get("/audio/:name", ctx => downloadFile(audioDir, ctx));

		// @ts-ignore
		router.post("/audio", adminFilter, uploader, (ctx: any) => uploadFile(audioDir, ctx));

		api.useResource(router.routes());
	};
}
