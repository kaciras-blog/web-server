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


const logger = getLogger("ImageService");

const SUPPORTED_FORMAT = ["jpg", "png", "gif", "bmp", "svg", "webp"];

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

	async function getImage(ctx: Context) {
		const match = FILE_PATH_PATTERN.exec(ctx.path);
		if (!match) {
			return ctx.status = 404;
		}
		const [, hash, ext] = match;

		if (SUPPORTED_FORMAT.indexOf(ext) < 0) {
			return ctx.status = 404;
		}

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
		const file = (ctx.req as MulterIncomingMessage).file;
		if (!file) {
			return ctx.status = 400;
		}
		logger.trace("有图片正在上传:" + file.filename);

		// mime.extension() 对 undefined 以及不支持的返回 false
		let ext = mime.extension(file.mimetype);
		if (ext === "jpeg") {
			ext = "jpg"; // 统一使用JPG
		} else if (!ext) {
			return ctx.status = 400;
		}

		if (SUPPORTED_FORMAT.indexOf(ext) < 0) {
			return ctx.status = 400;
		}

		const filename = await service.save(file.buffer, ext, {});

		// 保存的文件名通过 Location 响应头来传递
		ctx.status = 200;
		ctx.set("Location", `${CONTEXT_PATH}/${filename}`);
	}

	// 【修复】CONTEXT_PATH 要统一，以免发生判断条件不一致的问题
	return (ctx, next) => {
		if (!ctx.path.startsWith(CONTEXT_PATH)) {
			return next();
		}
		if (ctx.method === "GET") {
			return getImage(ctx);
		} else if (ctx.method === "POST") {
			return uploadImage(ctx);
		}
		ctx.status = 405;
	};
}
