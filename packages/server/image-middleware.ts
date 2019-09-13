/*
 * 简单的图片存储服务
 */
import path from "path";
import fs from "fs-extra";
import { Context, Middleware } from "koa";
import { MulterIncomingMessage } from "@koa/multer";
import Axios from "axios";
import { getLogger } from "log4js";
import mime from "mime-types";
import { ImageService, LocalFileSystemCache } from "./image-service";
import { configureForProxy } from "./axios-helper";
import { ImageError } from "./image-filter";


const logger = getLogger("ImageService");

const CONTEXT_PATH = "/image";
const FILE_PATH_PATTERN = /\/image\/(\w+)\.(\w+)$/;

interface MiddlewareOptions {
	directory: string;
	serverAddress: string;
}

function checkUploadPermission(url: string, ctx: Context) {
	return Axios.get(url + "/session/user", configureForProxy(ctx))
		.then((response) => response.data.id === 2).catch(() => false);
}

/**
 * 根据指定的选项创建图片存储中间件。
 *
 * @param options 选项
 * @return Koa的中间件函数
 */
export function imageMiddleware(options: MiddlewareOptions): Middleware {

	const service = new ImageService(new LocalFileSystemCache(options.directory));

	/*
	 * 关于防盗链的问题：
	 *
	 * 不能依赖 Referer 来做，因为 Referrer-Policy 可以禁止发送该头部，很多盗版站已经这么做了。
	 * 也不能要求必须有 Referer 头，因为 RSS 阅读器不发送 Referer 头。
	 *
	 * 浏览器里的 RSS 阅读器使用的插件内部地址也属于第三方站点，如果做防盗链则会影响它们。
	 */
	async function getImage(ctx: Context) {
		const match = FILE_PATH_PATTERN.exec(ctx.path);
		if (!match) {
			return ctx.status = 404;
		}
		const [, hash, ext] = match;

		const tags: any = {};

		const webpSupport = Boolean(ctx.accept.type("image/webp"));
		if (webpSupport) {
			tags.type = "webp";
		}
		const file = await service.get(hash, ext, tags);

		// 【更新】考虑到便于存储实现，undefined 也算文件不存在
		if (!file) {
			logger.warn("请求了不存在的图片：" + ctx.path);
			return ctx.status = 404;
		}

		const stats = await fs.stat(file);

		// TODO: 当前的类型选择不依赖url，不要再中间件里缓存它，故把Cache-Control设为private
		ctx.set("Cache-Control", "private, max-age=31536000");
		ctx.set("Content-Length", stats.size.toString());
		ctx.set("Last-Modified", stats.mtime.toUTCString());
		ctx.type = path.extname(file);
		ctx.body = fs.createReadStream(file);
	}

	/**
	 * 接收上传的图片，文件名为图片内容的SHA3值，扩展名取决于内容的 MIME-TYPE。
	 * 如果图片已存在则直接返回，否则将保存文件，保存的文件的URL由Location响应头返回。
	 *
	 * @param ctx 请求上下文
	 */
	async function uploadImage(ctx: Context) {
		if (!await checkUploadPermission(options.serverAddress, ctx)) {
			return ctx.status = 403;
		}

		const { file } = (ctx.req as MulterIncomingMessage);
		if (!file) {
			return ctx.status = 400;
		}
		logger.trace("有图片正在上传:" + file.filename);

		// mime.extension() 对 undefined 以及不支持的返回 false
		const type = mime.extension(file.mimetype);
		if (!type) {
			return ctx.status = 400;
		}

		const filename = await service.save(file.buffer, type);
		ctx.status = 200;
		ctx.set("Location", `${CONTEXT_PATH}/${filename}`);
	}

	// 【修复】CONTEXT_PATH 要统一，以免发生判断条件不一致的问题
	return (ctx, next) => {
		if (!ctx.path.startsWith(CONTEXT_PATH)) {
			return next();
		}
		try {
			if (ctx.method === "GET") {
				return getImage(ctx);
			} else if (ctx.method === "POST") {
				return uploadImage(ctx);
			}
		} catch (err) {
			if (err instanceof ImageError) {
				ctx.body = err.message;
				return ctx.status = 400;
			}
			throw err;
		}
		ctx.status = 405;
	};
}
