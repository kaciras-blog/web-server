/*
 * 简单的图片存储服务
 *
 * 1) 关于防盗链的问题：
 *
 * 不能依赖 Referer 来做，因为 Referrer-Policy 可以禁止发送该头部，很多盗版站已经这么做了。
 * 也不能要求必须有 Referer 头，因为 RSS 阅读器不发送 Referer 头。
 *
 * 浏览器里的 RSS 阅读器使用的插件内部地址也属于第三方站点，如果做防盗链则会影响它们。
 */
import path from "path";
import fs from "fs-extra";
import { Context, Middleware } from "koa";
import { MulterIncomingMessage } from "@koa/multer";
import Axios from "axios";
import { getLogger } from "log4js";
import mime from "mime-types";
import { configureForProxy } from "./axios-helper";
import { InvalidImageError } from "./image-filter";
import { PreGenerateImageService } from "./image-service";
import compose from "koa-compose";

const logger = getLogger("Image");

const CONTEXT_PATH = "/image";
const FILE_PATH_PATTERN = /\/image\/(\w+)\.(\w+)$/;

interface MiddlewareOptions {
	service: PreGenerateImageService;
	apiServer: string;
}

/**
 * 根据指定的选项创建图片存储中间件。
 *
 * @param options 选项
 * @return Koa的中间件函数
 */
export function imageMiddleware(options: MiddlewareOptions): Middleware {
	const { service, apiServer } = options;
	const url = apiServer + "/session/user";

	// 限制上传用户，仅博主能上传（如果要支持评论插入图片呢？）
	const checkPermission: Middleware = async (ctx, next) => {
		const response = await Axios.get(url, configureForProxy(ctx));
		response.data.id === 2 ? await next() : (ctx.status = 403);
	};

	/**
	 * 根据请求中携带的Accept信息，自动下载最佳的图片
	 *
	 * @param ctx 请求上下文
	 */
	async function getImage(ctx: Context) {
		const match = FILE_PATH_PATTERN.exec(ctx.path);
		if (!match) {
			return ctx.status = 404;
		}
		const [, hash, ext] = match;

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
		ctx.type = path.extname(result.path);
		ctx.body = fs.createReadStream(result.path);
	}

	/**
	 * 接收上传的图片，文件名为图片内容的SHA3值，扩展名取决于内容的 MIME-TYPE。
	 * 如果图片已存在则直接返回，否则将保存文件，保存的文件的URL由Location响应头返回。
	 *
	 * TODO: 因为要返回完整的路径，所以无法与CONTEXT_PATH分离
	 *
	 * @param ctx 请求上下文
	 */
	async function uploadImage(ctx: Context) {
		const { file } = (ctx.req as MulterIncomingMessage);
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
			ctx.set("Location", `${CONTEXT_PATH}/${name}`);
		} catch (err) {
			if (!(err instanceof InvalidImageError)) {
				throw err;
			}
			ctx.status = 400;
			ctx.body = err.message;

			// 虽然在请求中返回了错误信息，但还是记录一下日志
			logger.warn(err.message, err);
		}
	}

	const filteredUpload = compose<Context>([checkPermission, uploadImage]);

	return (ctx, next) => {
		if (!ctx.path.startsWith(CONTEXT_PATH)) {
			return next();
		}
		if (ctx.method === "GET") {
			return getImage(ctx);
		} else if (ctx.method === "POST") {
			return filteredUpload(ctx);
		}
		ctx.status = 405;
	};
}
