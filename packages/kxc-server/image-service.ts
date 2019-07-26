/*
 * 简单的图片存储服务
 */
import fs from "fs-extra";
import { Context, Middleware } from "koa";
import { getLogger } from "log4js";
import mime from "mime-types";
import crypto from "crypto";
import { LocalImageStore } from "./image-converter";
import { MulterIncomingMessage } from "koa-multer";
import * as path from "path";


const logger = getLogger("ImageService");

const SUPPORTED_FORMAT = ["jpg", "png", "gif", "bmp", "svg", "webp"];

const CONTEXT_PATH = "/image";
const FILE_PATH_PATTERN = /\/image\/(\w+)\.(\w+)$/;

/**
 * 根据指定的选项创建中间件。
 * 返回Koa的中间件函数，用法举例：app.use(require("./image")(options));
 *
 * @param store 图片存储
 * @return Koa的中间件函数
 */
export function createImageMiddleware(store: LocalImageStore): Middleware {

	async function getImage(ctx: Context) {
		const match = FILE_PATH_PATTERN.exec(ctx.path);
		if (!match) {
			return ctx.status = 404;
		}
		const [_, hash, ext] = match;

		if (SUPPORTED_FORMAT.indexOf(ext) < 0) {
			return ctx.status = 400;
		}
		const webpSupport = Boolean(ctx.accept.type("image/webp"));
		const file = await store.select(hash, ext, webpSupport);

		if (file === null) {
			return ctx.status = 404;
		}
		const stats = await fs.stat(file);
		ctx.set("Content-Length", stats.size.toString());
		ctx.set("Last-Modified", stats.mtime.toUTCString());

		// TODO: 当前的类型选择不依赖url，不要再中间件里缓存它，故把Cache-Control设为private
		ctx.set("Cache-Control", "private, max-age=31536000");

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

		// Multer 库直接修改 ctx.req
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

		const hash = crypto
			.createHash("sha3-256")
			.update(file.buffer)
			.digest("hex");

		await store.save(hash, ext, file.buffer);

		// 保存的文件名通过 Location 响应头来传递
		ctx.status = 200;
		ctx.set("Location", `${CONTEXT_PATH}/${hash}.${ext}`);
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
