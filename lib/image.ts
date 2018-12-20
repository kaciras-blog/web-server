import path from "path";
import fs from "fs-extra";
import koaSend from "koa-send";
import log4js from "log4js";
import { sha3_256 } from "js-sha3";
import { Middleware, Context } from "koa";


const logger = log4js.getLogger("Image");

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
		if ([".jpg", ".png", ".gif", ".bmp", ".svg"].indexOf(ext) < 0) {
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
