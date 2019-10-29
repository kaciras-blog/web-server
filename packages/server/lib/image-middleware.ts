/*
 * 1) 关于防盗链的问题：
 *
 * 不能依赖 Referer 来做，因为 Referrer-Policy 可以禁止发送该头部，很多盗版站已经这么做了。
 * 也不能要求必须有 Referer 头，因为 RSS 阅读器不发送 Referer 头。
 *
 * 浏览器里的 RSS 阅读器所在的插件内部地址也属于第三方站点，如果做防盗链则会影响它们。
 */
import pathlib from "path";
import fs from "fs-extra";
import { Context, Middleware } from "koa";
import { File } from "@koa/multer";
import { getLogger } from "log4js";
import mime from "mime-types";
import { InputDataError } from "@kaciras-blog/image/lib/exceptions";
import { PreGenerateImageService } from "@kaciras-blog/image/lib/image-service";

const logger = getLogger("Image");

/**
 * 根据请求中携带的Accept信息，自动下载最佳的图片。
 * 为了跟 @koa/router 一致，文件名通过 ctx.params.name 来传递。
 *
 * @param service
 * @param ctx 请求上下文
 */
export async function downloadImage(service: PreGenerateImageService, ctx: Context) {
	const name = ctx.params.name as string;
	if (!name) {
		return ctx.status = 404;
	}
	const [hash, ext] = name.split(".", 2);

	const acceptWebp = Boolean(ctx.accept.type("image/webp"));
	const acceptBrotli = Boolean(ctx.accept.encoding("br"));

	const result = await service.get(hash, ext, acceptWebp, acceptBrotli);

	if (!result) {
		logger.warn(`请求了不存在的图片：${hash}.${ext}`);
		return ctx.status = 404;
	}

	const stats = await fs.stat(result.path);

	// 修改时间要以被请求的图片为准而不是原图，因为处理器可能被修改并重新生成了缓存
	ctx.set("Last-Modified", stats.mtime.toUTCString());
	ctx.set("Cache-Control", "max-age=31536000");

	if (result.encoding) {
		ctx.set("Content-Encoding", result.encoding);
	} else {
		ctx.set("Content-Length", stats.size.toString());
	}
	ctx.type = pathlib.extname(result.path);
	ctx.body = fs.createReadStream(result.path);
}

/**
 * 接收上传的图片，文件名为图片内容的SHA3值，扩展名取决于内容的 MIME-TYPE。
 * 如果图片已存在则直接返回，否则将保存文件，保存的文件的URL由Location响应头返回。
 *
 * TODO: 因为要返回完整的路径，所以无法与CONTEXT_PATH分离
 *
 * @param service
 * @param ctx 请求上下文
 */
export async function uploadImage(service: PreGenerateImageService, ctx: Context) {
	const file: File = ctx.file;
	if (!file) {
		return ctx.status = 400;
	}

	// mime.extension() 对 undefined 以及不支持的返回 false
	const type = mime.extension(file.mimetype);
	if (!type) {
		return ctx.status = 400;
	}

	try {
		const name = await service.save(file.buffer, type);
		ctx.status = 200;
		ctx.set("Location", `${ctx.path}/${name}`);
	} catch (err) {
		if (!(err instanceof InputDataError)) {
			throw err;
		}
		ctx.status = 400;
		ctx.body = err.message;

		// 虽然在请求中返回了错误信息，但还是记录一下日志
		logger.warn(err.message, err);
	}
}

/**
 * 根据指定的选项创建图片存储中间件。
 *
 * @return Koa的中间件函数
 */
export function route(contextPath: string, downloadFn: Middleware, uploadFn: Middleware): Middleware {
	const regex = new RegExp(contextPath + "/(\\w+\\.\\w+)$");

	return (ctx, next) => {
		const { method, path } = ctx;

		if (!path.startsWith(contextPath)) {
			return next();
		}

		if (method === "GET") {
			const match = regex.exec(path);
			if (!match) {
				return ctx.status = 404;
			}
			ctx.params = { name: match[1] };
			return downloadFn(ctx, next);
		}

		if (method === "POST") {
			if (path !== contextPath) {
				return ctx.status = 404;
			}
			return uploadFn(ctx, next);
		}

		ctx.status = 405;
		ctx.body = "该API仅支持POST和GET方法";
	};
}
