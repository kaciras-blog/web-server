import path from "path";
import fs from "fs-extra";
import koaSend from "koa-send";
import log4js from "log4js";
import { sha3_256 } from "js-sha3";
import { Middleware, Context } from "koa";


const logger = log4js.getLogger("Image");

const SUPPORTED_FORMAT = [".jpg", ".png", ".gif", ".bmp", ".svg"];

/**
 * 根据指定的选项创建中间件。
 * 返回Koa的中间件函数，用法举例：app.use(require("./image")(options));
 *
 * @param options 选项
 * @return Koa的中间件函数
 */
export default function (options: any): Middleware {
	fs.ensureDirSync(options.imageRoot);

	async function getImage(ctx: Context): Promise<void> {
		const name = ctx.path.substring("/image/".length);
		if (!name || /[\\/]/.test(name)) {
			ctx.status = 404;
		} else {
			await koaSend(ctx, name, { root: options.imageRoot, maxage: options.cacheMaxAge });
		}
	}

	/**
	 * 接收上传的图片，文件名为图片内容的SHA3值，扩展名与原始文件名一样。
	 * 如果图片已存在则直接返回，否则将保存文件，保存的文件的URL由Location响应头返回。
	 *
	 * @param ctx 请求上下文
	 */
	async function uploadImage(ctx: Context) {
		logger.trace("有图片正在上传");

		// Multer 库直接修改ctx.req
		const file = (ctx.req as any).file;
		if (!file) {
			return ctx.status = 400;
		}

		let ext = path.extname(file.originalname).toLowerCase();
		if (ext === ".jpeg") {
			ext = ".jpg"; // 统一使用JPG
		}
		if (SUPPORTED_FORMAT.indexOf(ext) < 0) {
			return ctx.status = 400;
		}

		const name = sha3_256(file.buffer) + ext;
		const store = path.join(options.imageRoot, name);

		if (await fs.pathExists(store)) {
			ctx.status = 200;
		} else {
			logger.debug("保存上传的图片:", name);
			await fs.writeFile(store, file.buffer);
			ctx.status = 201;
		}

		// 保存的文件名通过 Location 响应头来传递
		ctx.set("Location", "/image/" + name);
	}

	return async (ctx, next) => {
		if (!ctx.path.startsWith("/image")) {
			await next();
		} else if (ctx.method === "GET") {
			await getImage(ctx);
		} else if (ctx.method === "POST") {
			await uploadImage(ctx);
		} else {
			ctx.status = 405;
		}
	};
}
