import { join } from "path";
import Axios from "axios";
import log4js from "log4js";
import { BaseContext, ExtendableContext, Next } from "koa";
import conditional from "koa-conditional-get";
import multer from "@koa/multer";
import Router from "@koa/router";
import bodyParser from "koa-bodyparser";
import {
	CachedService,
	DispatchService,
	LocalFileStore,
	RasterOptimizer,
	SVGOptimizer,
	VariantService,
} from "@kaciras-blog/media";
import AppBuilder, { FunctionPlugin } from "./AppBuilder.js";
import { ResolvedConfig } from "./config.js";
import { download, upload } from "./koa/media.js";
import sitemapHandler from "./koa/sitemap.js";
import feedHandler from "./koa/feed.js";
import { configureForProxy } from "./axios-helper.js";

const logger = log4js.getLogger();

const CSP_REPORT_URI = "/csp-report";

/**
 * 设置一些安全相关的响应头，一些指令在 <meta> 元素中无效，必须在服务端配置。
 *
 * <h2>Content-Security-Policy</h2>
 * frame-ancestors: 没想出有什么嵌入其它网站的必要。
 * object-src: 禁止一些过时元素。
 * block-all-mixed-content: 我全站都是 HTTPS，也不太会去用 HTTP 的服务。
 * 其他的限制太死了，暂时没开启。
 *
 * <h2>COEP & COOP</h2>
 * COEP 图片视频等资源只能从同源或者支持 CORS 的三方加载，禁止传统的非 CORS 模式。
 *      如果要用第三方图床、视频之类的需要注意。
 * COOP 阻止了跨域跳转和弹窗时的 window.opener 访问，一些老旧的支付系统可能用到，本站没有。
 *
 * 这两个头部同时使用可以解锁 SharedArrayBuffer 等功能。
 *
 * <h2>HSTS</h2>
 * 纯粹是跟底层 TLS 相关的头，不应该在这里配置，而且在 localhost 下会弹一堆警告。
 */
async function harden(ctx: BaseContext, next: Next) {
	await next();
	// ctx.set("Cross-Origin-Embedder-Policy", "require-corp");
	ctx.set("Cross-Origin-Opener-Policy", "same-origin");
	ctx.set("Content-Security-Policy", "frame-ancestors 'self'; " +
		"object-src 'none'; block-all-mixed-content; report-uri " + CSP_REPORT_URI);
}

function reportCSP(ctx: ExtendableContext) {
	ctx.status = 204;
	if (ctx.request.body) {
		logger.warn("CSP Violation: ", ctx.request.body);
	} else {
		logger.warn("CSP Violation: No data received!");
	}
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
 * 限制后面的中间件只能由管理员访问。
 *
 * @param host 内容服务器地址
 * @return 拦截中间件
 */
export function adminOnlyFilter(host: string) {
	const url = host + "/user";

	return async (ctx: ExtendableContext, next: Next) => {
		const { data } = await Axios.get(url, configureForProxy(ctx));
		return data.id === 2 ? next() : (ctx.status = 403);
	};
}

/*
 * 【关于 koa-etag】
 * 没有使用，因为所有资源都可以用时间缓存，而且 koa-etag 内部使用 sha1 计算 Etag，
 * 对于图片这样较大的资源会占用 CPU，而我的VPS处理器又很垃圾。
 */
export default function getBlogPlugin(options: ResolvedConfig): FunctionPlugin {
	const address = options.backend.internal;
	const { app } = options;

	return (builder: AppBuilder) => {
		builder.useBeforeAll(conditional());
		builder.useBeforeAll(bodyParser());
		builder.useBeforeAll(harden);

		const adminFilter = adminOnlyFilter(address);
		const router = new Router();

		// @ts-ignore Record 默认有 undefined 了，没想好怎么改。
		router.get("/feed/:type", feedHandler(options));
		router.get("/sw-check", toggleSW(app.serviceWorker));
		router.get("/sitemap.xml", sitemapHandler(address));
		router.post(CSP_REPORT_URI, reportCSP);

		// 过大的媒体建议直接传到第三方存储
		const multerInstance = multer({ limits: { fileSize: 50 * 1024 * 1024 } });
		const uploader = multerInstance.single("file");

		const imageStore = new LocalFileStore(
			join(app.dataDir.data, "image"),
			join(app.dataDir.cache, "image"),
		);
		const service = new DispatchService(
			{ "svg": new CachedService(imageStore, new SVGOptimizer()) },
			new CachedService(imageStore, new RasterOptimizer()),
		);
		// @ts-ignore
		router.get("/image/:name", ctx => download(service, ctx));
		router.post("/image", adminFilter, uploader, (ctx: any) => upload(service, ctx));

		const videoStore = new LocalFileStore(
			join(app.dataDir.data, "video"),
			join(app.dataDir.cache, "video"),
		);
		const vs = new VariantService(videoStore, ["av1"]);
		// @ts-ignore
		router.get("/video/:name", ctx => download(vs, ctx));
		router.post("/video", adminFilter, uploader, (ctx: any) => upload(vs, ctx));

		builder.useResource(router.routes());
	};
}
