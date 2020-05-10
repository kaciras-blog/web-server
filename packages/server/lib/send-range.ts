/*
 * koa-range 2年没更新，issues里的问题也没解决，也没找到其它能替代的库，故自己写一个：
 * https://github.com/koajs/koa-range
 */
import fs from "fs-extra";
import { Context } from "koa";
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

	ctx.status = 206;

	if (ranges.length > 1) {
		sendMultipartRanges(ctx, size, filename, ranges);
	} else {
		const { start, end } = ranges[0];
		ctx.set("Content-Length", (end - start + 1).toString());
		ctx.set("Content-Range", `bytes ${start}-${end}/${size}`);
		ctx.body = fs.createReadStream(filename, ranges[0]);
	}
}

// 参考 https://github.com/rexxars/send-ranges
function sendMultipartRanges(ctx: Context, size: number, filename: string, ranges: Range[]) {
	const stream = new CombinedStream();
	const randomHex = randomHex24();
	const boundary = "--" + randomHex;

	function getMultipartHeader(start: number, end: number) {
		const range = `Content-Range: bytes ${start}-${end}/${size}`;
		const type = `Content-Type: ${ctx.type}`;
		return `${boundary}\r\n${type}\r\n${range}\r\n\r\n`;
	}

	let length = 0;

	for (const range of ranges) {
		const { start, end } = range;
		const header = getMultipartHeader(start, end);

		stream.append(header)
		stream.append(fs.createReadStream(filename, range));
		stream.append("\r\n");

		length += header.length + (end - start + 1) + 2;
	}

	stream.append(`${boundary}--\r\n`);
	length += boundary.length + 4;

	ctx.set("Content-Length", length.toString());
	ctx.type = `multipart/byteranges; boundary=${randomHex}`;
	ctx.body = stream;
}

function randomHex24() {
	let boundary = "";
	for (let i = 0; i < 24; i++) {
		boundary += Math.floor(Math.random() * 15).toString(16);
	}
	return boundary;
}
