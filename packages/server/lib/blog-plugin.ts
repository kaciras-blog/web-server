import crypto from "crypto";
import fs from "fs-extra";
import path from "path";
import Axios from "axios";
import { Context, Next } from "koa";
import { getLogger } from "log4js";
import conditional from "koa-conditional-get";
import cors from "@koa/cors";
import compress from "koa-compress";
import multer from "@koa/multer";
import mime from "mime-types";
import Router, { Middleware } from "@koa/router";
import bodyParser from "koa-bodyparser";
import compose from "koa-compose";
import { PreGenerateImageService } from "@kaciras-blog/image/lib/image-service";
import { localFileStore } from "@kaciras-blog/image/lib/image-store";
import installCSPPlugin from "./csp-plugin";
import { downloadImage, route, uploadImage } from "./image-middleware";
import createSitemapMiddleware from "./sitemap";
import createFeedMiddleware  from "./feed";
import sendFileRange from "./send-range";
import { configureForProxy } from "./axios-helper";
import ApplicationBuilder, { FunctionPlugin } from "./ApplicationBuilder";
import { AppOptions } from "./options";


const logger = getLogger();

/**
 * 前端页面是否注册 ServiceWorker 的检查点，该URI返回200状态码时表示注册，否则应当注销。
 *
 * @param register 是否注册 ServiceWorker
 */
export function serviceWorkerToggle(register?: boolean): Middleware {
	return (ctx, next) => {
		ctx.status = register ? 200 : 205;
		ctx.flushHeaders();
	};
}

/**
 * 拦截某些资源，ctx.path 匹配到任一模式串的请求将被拦截，并返回404。
 *
 * @param patterns 模式串
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

/**
 * 用 image-middleware 里的函数组合成图片处理中间件。
 * TODO: 支持评论插入图片
 *
 * @param options 选项
 */
function createImageMiddleware(options: AppOptions) {
	const service = new PreGenerateImageService(localFileStore(options.dataDir));
	const url = options.serverAddress + "/session/user";

	const downloadFn = (ctx: any) => downloadImage(service, ctx);
	let uploadFn: Middleware = (ctx) => uploadImage(service, ctx);

	// 限制上传用户，仅博主能上传
	async function onlyAdministrator(ctx: Context, next: Next) {
		const { data } = await Axios.get(url, configureForProxy(ctx));
		return data.id === 2 ? next() : (ctx.status = 403);
	}

	uploadFn = compose<Context>([onlyAdministrator, uploadFn]);

	return route("/image", downloadFn, uploadFn);
}

// 【注意】没有使用 Etag，因为所有资源都可以用时间缓存，而且 koa-etag 内部使用 sha1 计算 Etag，
// 对于图片这样较大的资源会占用 CPU，而我的VPS处理器又很垃圾。
export default function getBlogPlugin(options: AppOptions): FunctionPlugin {
	const videoDir = path.join(options.dataDir, "video");
	fs.ensureDirSync(videoDir);
	const url = options.serverAddress + "/session/user";

	async function videoMiddleware(ctx: Context, next: Next) {
		if (!ctx.path.startsWith("/video")) {
			return next();
		}
		if (ctx.method === "GET") {
			const name = path.basename(ctx.path.substring(6));
			const fullname = path.join(videoDir, name);
			const stats = await fs.stat(fullname);
			return sendFileRange(ctx, fullname, stats.size);
		}
		if (ctx.method === "POST") {
			const { data } = await Axios.get(url, configureForProxy(ctx));
			if (data.id !== 2) {
				return ctx.status = 403;
			}

			const { buffer } = ctx.file;
			const hash = crypto
				.createHash("sha3-256")
				.update(buffer)
				.digest("hex");

			const name = hash + "." + mime.extension(ctx.file.mimetype);
			await fs.writeFile(path.join(videoDir, name), buffer);

			ctx.status = 201;
			ctx.set("Location", `${ctx.path}/${name}`);
		} else {
			ctx.status = 415;
		}
	}

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

		const router = new Router();

		router.get("/sw-check", serviceWorkerToggle(options.serviceWorker));
		router.get("/feed/:type", createFeedMiddleware(options.serverAddress));
		router.get("/sitemap.xml", createSitemapMiddleware(options.serverAddress));

		router.get("/image/:name", createImageMiddleware(options));
		router.post("/image", createImageMiddleware(options));

		router.get("/video/:name", videoMiddleware(options.serverAddress));
		router.post("/video", videoMiddleware(options.serverAddress));

		api.useResource(router.routes);
	};
}
