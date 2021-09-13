import { ParsedUrlQuery } from "querystring";
import { BaseContext, Context, ExtendableContext, Middleware, Next, ParameterizedContext } from "koa";
import { getLogger } from "log4js";
import { MediaError } from "@kaciras-blog/media/lib/errors";
import { WebFileService } from "@kaciras-blog/media/lib/WebFileService";

const logger = getLogger("media");

/**
 * 下载图片时的 Koa 上下文，文件名通过 ctx.params.name 来传递。
 * 之所以这么设计是为了跟 @koa/router 一致。
 */
export interface DownloadContext extends ExtendableContext {
	params: { name: string };
}

function acceptList(ctx: BaseContext, name: string) {
	let header = ctx.headers[name];
	if (Array.isArray(header)) {
		header = header[0];
	}
	if (!header) {
		return [];
	}
	return header.split(/,\s*/g);
}

function getParams(query: ParsedUrlQuery) {
	const kv = Object.entries(query);
	const entries = kv.map(([k, v]) => [k, v ? v[0] : ""]);
	return Object.fromEntries(entries);
}

/**
 * 处理下载图片的请求，自动下载最佳的资源。
 *
 * @param service 图片服务
 * @param ctx 请求上下文
 */
export async function download(service: WebFileService, ctx: DownloadContext) {
	const { name } = ctx.params;

	const result = await service.load({
		name: ctx.params.name,
		acceptTypes: acceptList(ctx,"accept"),
		acceptEncodings: acceptList(ctx,"accept-encoding"),
		parameters: getParams(ctx.query),
	});

	if (!result) {
		logger.warn(`请求了不存在的资源：${name}`);
		return ctx.status = 404;
	}

	const { mtime, data, size } = result.file;

	ctx.type = result.mimetype;
	ctx.body = data;

	if (result.encoding) {
		ctx.set("Content-Encoding", result.encoding);
	} else {
		ctx.set("Content-Length", size.toString());
	}

	// 修改时间要以被请求的资源为准而不是原图，因为处理器可能被修改并重新生成了缓存
	ctx.set("Last-Modified", mtime.toUTCString());
	ctx.set("Cache-Control", "public,max-age=31536000");
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
		ctx.body = await service.save({
			buffer: file.buffer,
			mimetype: file.mimetype,
			rawName: file.originalname,
			parameters: getParams(ctx.query),
		});
	} catch (err) {
		if (!(err instanceof MediaError)) {
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
 * 1）GET 方法映射到 downloadFn，并自动设置 ctx.params.rawName。
 * 2）POST 方法映射到 uploadFn。
 * 3）其他方法返回405.
 * 4）指定 contextPath，非此路径下的请求将原样传递给下一个中间件。
 *
 * 相当于用@koa/router的代码：
 * @example
 * router.get(`${contextPath}/:rawName`, downloadFn);
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
		ctx.body = "该 API 仅支持 POST 和 GET 方法";
	};
}
