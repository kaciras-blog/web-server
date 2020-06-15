import { Context, ExtendableContext, Middleware, Next, ParameterizedContext } from "koa";
import { InputDataError } from "@kaciras-blog/image/lib/errors";
import { WebFileService } from "@kaciras-blog/media/lib/WebFileService";
import { getLogger } from "log4js";

const logger = getLogger("media");

/**
 * 下载图片时的 Koa 上下文，文件名通过 ctx.params.name 来传递。
 * 之所以这么设计是为了跟 @koa/router 一致。
 */
export interface DownloadContext extends ExtendableContext {
	params: { name: string };
}

/**
 * 处理下载图片的请求，自动下载最佳的资源。
 *
 * @param service 图片服务
 * @param ctx 请求上下文
 */
export async function download(service: WebFileService, ctx: DownloadContext) {

}

/**
 * 接收并保存上传的资源。
 *
 * @param service 图片服务
 * @param ctx 请求上下文
 */
export async function upload(service: WebFileService, ctx: Context) {
	const file = ctx.file;
	if (!file) {
		return ctx.status = 400;
	}

	try {
		ctx.body = await service.save(file, ctx.query);
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
 * 【新中间件的功能】
 * 1）GET 方法映射到 downloadFn，并自动设置 ctx.params.name。
 * 2）POST 方法映射到 uploadFn。
 * 3）其他方法返回405.
 * 4）指定 contextPath，非此路径下的请求将原样传递给下一个中间件。
 *
 * 相当于用@koa/router的代码：
 * @example
 * router.get(`${contextPath}/:name`, downloadFn);
 * router.post(contextPath, uploadFn);
 *
 * @param contextPath 上下文路径
 * @param downloadFn 下载请求处理函数
 * @param uploadFn 上传请求处理函数
 * @return 组合后的 Koa 的中间件
 */
export function route(contextPath: string, downloadFn: Middleware, uploadFn: Middleware) {
	const regex = new RegExp(contextPath + "/(\\w+\\.\\w+)$");

	return (ctx: ParameterizedContext, next: Next) => {
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
