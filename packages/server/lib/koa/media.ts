import { ParsedUrlQuery } from "querystring";
import { Context, ExtendableContext } from "koa";
import log4js from "log4js";
import mime from "mime-types";
import { MediaError, MediaService } from "@kaciras-blog/media";

const logger = log4js.getLogger("media");

/**
 * 下载图片时的 Koa 上下文，文件名通过 ctx.params.name 来传递。
 * 之所以这么设计是为了跟 @koa/router 一致。
 */
export interface DownloadContext extends ExtendableContext {
	params: { name: string };
}

function acceptList(header: string | string[]) {
	if (Array.isArray(header)) {
		header = header[0];
	}
	if (!header) {
		return [];
	}
	return header.split(/,\s*/g);
}

/**
 * 如果查询参数的值有多个，只保留第一个。
 */
function filterFirst(query: ParsedUrlQuery) {
	const result: Record<string, string> = {};
	for (const [k, v] of Object.entries(query)) {
		result[k] = Array.isArray(v) ? v[0] : v!;
	}
	return result;
}

/**
 * 处理下载图片的请求，自动下载最佳的资源。
 *
 * @param service 图片服务
 * @param ctx 请求上下文
 */
export async function download(service: MediaService, ctx: DownloadContext) {
	const { name } = ctx.params;
	const { codecs } = ctx.query;

	const acceptTypes = acceptList(ctx.get("accept"))
		.map(mime.extension)
		.filter(Boolean) as string[];

	const parsedCodecs = typeof codecs !== "string"
		? []
		: codecs.split(",");

	const result = await service.load({
		name,
		codecs: parsedCodecs,
		acceptTypes,
		acceptEncodings: acceptList(ctx.get("accept-encoding")),
		parameters: filterFirst(ctx.query),
	});

	if (!result) {
		logger.warn(`请求了不存在的资源：${name}`);
		return ctx.status = 404;
	}

	const { mtime, data, size } = result.file;

	ctx.type = result.type;
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
export async function upload(service: MediaService, ctx: Context) {
	const file = ctx.file;
	if (!file) {
		return ctx.status = 400;
	}

	const type = mime.extension(file.mimetype);
	if (!type) {
		ctx.body = "不支持的类型：" + file.mimetype;
		return ctx.status = 400;
	}

	try {
		const name = await service.save({
			buffer: file.buffer,
			type,
			parameters: filterFirst(ctx.query),
		});
		ctx.status = 200;
		ctx.set("Location", `${ctx.path}/${name}`);
	} catch (err) {
		if (!(err instanceof MediaError)) {
			throw err;
		}
		ctx.status = 400;
		ctx.body = { detail: err.message };

		// 虽然在请求中返回了错误信息，但还是记录一下日志
		logger.warn(err.message, err);
	}
}
