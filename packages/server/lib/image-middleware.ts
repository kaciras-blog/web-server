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
import { Context, ExtendableContext, Middleware } from "koa";
import { File } from "@koa/multer";
import { getLogger } from "log4js";
import mime from "mime-types";
import { InputDataError } from "@kaciras-blog/image/lib/exceptions";
import { PreGenerateImageService } from "@kaciras-blog/image/lib/image-service";

const logger = getLogger("Image");

/**
 * 下载图片时的 Koa 上下文，文件名通过 ctx.params.name 来传递。
 * 之所以这么设计是为了跟 @koa/router 一致。
 */
export interface DownloadContext extends ExtendableContext {
	params: { name: string; };
}

/**
 * 处理下载图片的请求，自动下载最佳的图片。
 *
 * @param service 图片服务
 * @param ctx 请求上下文
 */
export async function downloadImage(service: PreGenerateImageService, ctx: DownloadContext) {
	const [hash, ext] = ctx.params.name.split(".", 2);
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
 * 接收并保持上传的图片，保存的文件的路径由 Location 头返回，对不支持的图片返回400。
 *
 * Location 头的格式为`${ctx.path}/${文件名}`，如果搭配 {@code downloadImage} 就需要保持 ContextPath 一致。
 *
 * @param service 图片服务
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
 * 该函数的作用类似 @koa/router，组合上传和下载函数，返回新的中间件。
 *
 * 【新的中间件的功能】
 * 1）GET 方法映射到 downloadFn，并自动设置 ctx.params.name。
 * 2）POST 方法映射到 uploadFn。
 * 3）其他方法返回405.
 * 4）能够指定 contextPath，非此路径下的请求将原样传递给下一个。
 *
 * @param contextPath 上下文路径
 * @param downloadFn 下载请求处理函数
 * @param uploadFn 上传请求处理函数
 * @return 组合后的 Koa 的中间件
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
