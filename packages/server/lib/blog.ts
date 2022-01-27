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
	const address = options.contentServer.internalOrigin;
	const { app } = options;

	return (builder: AppBuilder) => {
		builder.useBeforeAll(conditional());
		builder.useBeforeAll(bodyParser());
		builder.useBeforeAll(securityFilter);

		const adminFilter = adminOnlyFilter(address);
		const router = new Router();

		// @ts-ignore Record 默认有 undefined 了，没想好怎么改。
		router.get("/feed/:type", feedHandler(options));
		router.get("/sw-check", toggleSW(app.serviceWorker));
		router.get("/sitemap.xml", sitemapHandler(address));
		router.post(CSP_REPORT_URI, cspReporter);

		// 过大的媒体建议直接传到第三方存储
		const multerInstance = multer({ limits: { fileSize: 50 * 1024 * 1024 } });
		const uploader = multerInstance.single("file");

		const imageStore = new LocalFileStore(app.dataDir, "image");
		const service = new DispatchService(
			{ "svg": new CachedService(imageStore, new SVGOptimizer(imageStore)) },
			new CachedService(imageStore, new RasterOptimizer(imageStore)),
		);
		// @ts-ignore
		router.get("/image/:name", ctx => download(service, ctx));
		router.post("/image", adminFilter, uploader, (ctx: any) => upload(service, ctx));

		const vs = new VariantService(new LocalFileStore(app.dataDir, "video"), ["av1"]);
		// @ts-ignore
		router.get("/video/:name", ctx => download(vs, ctx));
		router.post("/video", adminFilter, uploader, (ctx: any) => upload(vs, ctx));

		builder.useResource(router.routes());
	};
}
