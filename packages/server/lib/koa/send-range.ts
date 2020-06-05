/*
 * koa-range 2年没更新，issues里的问题也没解决，也没找到其它能替代的库，故自己写一个：
 * https://github.com/koajs/koa-range
 */
import crypto from "crypto";
import fs from "fs-extra";
import { BaseContext } from "koa";
import parseRange, { Range } from "range-parser";
import CombinedStream from "combined-stream";

/**
 * 处理Range请求，发送部分文件。
 *
 * 该函数中会设置状态码，Accept-Ranges，Content-Length 和 Content-Range 头，
 * 请在调用该函数之前设置ctx.type
 *
 * 暂不支持 If-Range 头。
 *
 * @see https://tools.ietf.org/html/rfc7233#section-4.1
 *
 * @param ctx Koa上下文
 * @param filename 文件路径
 * @param size 文件的大小，可以用 fs.stat(filename).size 获取
 */
export default function sendFileRange(ctx: BaseContext, filename: string, size: number) {
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

	ctx.status = 206;

	if (ranges.length > 1) {
		sendMultipartRanges(ctx, filename, size, ranges);
	} else {
		const { start, end } = ranges[0];
		ctx.set("Content-Length", (end - start + 1).toString());
		ctx.set("Content-Range", `bytes ${start}-${end}/${size}`);
		ctx.body = fs.createReadStream(filename, ranges[0]);
	}
}

/**
 * 发送多个区间，对应 multipart/byteranges 类型的响应。
 *
 * 主要参考了 https://github.com/rexxars/send-ranges
 * boundary的定义 https://tools.ietf.org/html/rfc2046#section-5.1.1
 *
 * @param ctx Koa上下文
 * @param filename 文件名
 * @param size 文件大小
 * @param ranges 要发送的区间
 */
function sendMultipartRanges(ctx: BaseContext, filename: string, size: number, ranges: Range[]) {
	const stream = new CombinedStream();

	// 24个横杠 + 16个base64字符作为分隔
	const bcharsnospace = crypto.randomBytes(12).toString("base64");
	const boundary = "----------------" + bcharsnospace;

	function getMultipartHeader(start: number, end: number) {
		const range = `Content-Range: bytes ${start}-${end}/${size}`;
		const type = `Content-Type: ${ctx.type}`;
		return `--${boundary}\r\n${type}\r\n${range}\r\n\r\n`;
	}

	// 长度计算挺麻烦，所以在下面边生成内容边统计
	let length = 0;

	for (const range of ranges) {
		const { start, end } = range;
		const header = getMultipartHeader(start, end);

		stream.append(header)
		stream.append(fs.createReadStream(filename, range));
		stream.append("\r\n");

		length += header.length + (end - start + 1) + 2;
	}

	stream.append(`--${boundary}--\r\n`);
	length += boundary.length + 6;

	ctx.set("Content-Length", length.toString());
	ctx.type = `multipart/byteranges; boundary=${boundary}`;
	ctx.body = stream;
}
