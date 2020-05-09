/*
 * koa-range 2年没更新，issues里的问题也没解决，也没找到其它能替代的库，故自己写一个：
 * https://github.com/koajs/koa-range
 *
 * 如果要做 multipart/byteranges 可以参考一个Express的实现：
 * https://github.com/rexxars/send-ranges
 */
import fs from "fs-extra";
import { Context } from "koa";
import parseRange from "range-parser";

/**
 * 处理Range请求，发送部分文件。
 *
 * 该函数中会设置状态码，Accept-Ranges，Content-Length 和 Content-Range 头。
 *
 * 不支持多片响应，多个Range时仅发送第一个。
 * 不支持 If-Range 头。
 *
 * @param ctx Koa上下文
 * @param filename 文件路径
 * @param size 文件的大小，可以用 fs.stat(filename).size 获取
 */
export default function sendFileRange(ctx: Context, filename: string, size: number) {
	ctx.set("Accept-Ranges", "bytes");

	const rangeHeader = ctx.get("Range");
	if (!rangeHeader) {
		ctx.set("Content-Length", size.toString());
		return ctx.body = fs.createReadStream(filename);
	}

	// 未检查 type，反正正常都是 bytes
	const ranges = parseRange(size, rangeHeader);
	if (ranges === -2) {
		return ctx.status = 400;
	}
	if (ranges === -1) {
		ctx.set("Content-Range", `bytes */${size}`);
		return ctx.status = 416;
	}

	const { start, end } = ranges[0];
	ctx.status = 206;
	ctx.set("Content-Range", `bytes ${start}-${end}/${size}`);
	ctx.set("Content-Length", (end - start + 1).toString());
	ctx.body = fs.createReadStream(filename, { start, end });
}
