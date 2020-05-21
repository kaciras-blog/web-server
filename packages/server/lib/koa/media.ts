import { Context, ExtendableContext } from "koa";
import { PreGenerateImageService } from "@kaciras-blog/image/lib/image-service";
import mime from "mime-types";
import { InputDataError } from "@kaciras-blog/image/lib/errors";
import { WebFileService } from "@kaciras-blog/media/lib/WebFileService";

/**
 * 下载图片时的 Koa 上下文，文件名通过 ctx.params.name 来传递。
 * 之所以这么设计是为了跟 @koa/router 一致。
 */
export interface DownloadContext extends ExtendableContext {
	params: { name: string };
}

/**
 * 处理下载图片的请求，自动下载最佳的图片。
 *
 * @param service 图片服务
 * @param ctx 请求上下文
 */
export async function download(service: WebFileService, ctx: DownloadContext) {

}

/**
 * 接收并保持上传的图片，保存的文件的路径由 Location 头返回，对不支持的图片返回400。
 *
 * Location 头的格式为`${ctx.path}/${文件名}`，如果搭配 {@code downloadImage} 就需要保持 ContextPath 一致。
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
		// logger.warn(err.message, err);
	}
}
