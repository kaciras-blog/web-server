/*
 * 简单的图片存储服务
 */
import fs from "fs-extra";
import { Context, Middleware } from "koa";
import { getLogger } from "log4js";
import mime from "mime-types";
import path from "path";
import koaSend from "koa-send";
import crypto from "crypto";
import { LocalImageStore } from "./image-converter";
import { MulterIncomingMessage } from "koa-multer";


const logger = getLogger("ImageService");

export interface ImageMiddlewareOptions {
	imageRoot: string;
	cacheMaxAge: number;
}

const SUPPORTED_FORMAT = ["jpg", "png", "gif", "bmp", "svg", "webp"];
const CONTEXT_PATH = "/image/";

/**
 * 根据指定的选项创建中间件。
 * 返回Koa的中间件函数，用法举例：app.use(require("./image")(options));
 *
 * @param options 选项
 * @return Koa的中间件函数
 */
export function createImageMiddleware(options: ImageMiddlewareOptions): Middleware {
	fs.ensureDirSync(options.imageRoot);
	const store = new LocalImageStore(options.imageRoot);

	async function getImage(ctx: Context): Promise<void> {
		const name = ctx.path.substring(CONTEXT_PATH.length);
		if (!name || /[\\/]/.test(name)) {
			ctx.status = 404;
		} else {
			await koaSend(ctx, name, { root: options.imageRoot, maxAge: 31536000 });
		}
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

		const buffer = file.buffer;

		const sha3_256 = crypto.createHash("sha3-256");
		const hash = sha3_256.update(buffer).digest("hex") + "." + ext;

		const name = await store.save({ hash, type: ext, buffer });

		// if (await fs.pathExists(store)) {
		// 	ctx.status = 200;
		// } else {
		// 	await fs.writeFile(store, buffer);
		// 	ctx.status = 201;
		// }

		// 保存的文件名通过 Location 响应头来传递
		ctx.set("Location", CONTEXT_PATH + name);
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
