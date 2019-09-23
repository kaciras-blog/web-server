/**
 * imagemin 对某些格式会将图片缓冲写入到临时文件，然后启动进程执行相关的图片处理程序，这方法很低效。
 */
import sharp from "sharp";
import Pngquant from "imagemin-pngquant";
import Gifsicle from "imagemin-gifsicle";
import mozjpeg from "mozjpeg";
import execa from "execa";
import { BaseError } from "make-error";

// JS 这垃圾语言实现个自定义异常坑真是多……
// @formatter:off

/** 图片的数据无效或损坏 */
export class InvalidImageError extends BaseError {
	constructor(message?: string) { super(message); }
}

/** 某个处理过程不适用于该图片 */
export class ImageUnhandlableError extends BaseError {
	constructor(message?: string) { super(message); }
}
// @formatter:on

export interface ImageTags {
	readonly [key: string]: string;
}

export type ImageFilter = (buffer: Buffer, argument: string) => Promise<Buffer>;

// filters 要用 ES6 的 Map，因为它的遍历顺序是插入顺序
// TODO: 多个输出可以缓存中间结果
export function runFilters(buffer: Buffer, filters: Map<string, ImageFilter>, tags: ImageTags) {
	return Array.from(filters.entries())
		.filter((e) => e[0] in tags)
		.reduce((prev, [k, filter]) => prev.then((input) => filter(input, tags[k])), Promise.resolve(buffer));
}

const pngquant = Pngquant();
const gifsicle = Gifsicle({ optimizationLevel: 3 });

/** webp 转码的最低压缩比，达不到的认为无法压缩 */
const WEBP_MIN_COMPRESS_RATE = 0.9;

export async function codecFilter(buffer: Buffer, targetType: string): Promise<Buffer> {
	switch (targetType) {
		case "webp":
			// TODO: sharp 0.23.0 不支持 webp 动画，gif2webp-bin 安装失败
			if (isGif(buffer)) {
				throw new ImageUnhandlableError("暂不支持GIF转WEBP");
			}

			// Google 官网说 libwebp 默认的质量是75，但 sharp 默认80，这里还是用 Google 的
			const lossy = await sharp(buffer)
				.webp({ quality: 75 })
				.toBuffer({ resolveWithObject: true });

			/*
			 * 测试中发现黑色背景+彩色文字的图片从PNG转WEBP之后更大了，且失真严重。
			 * 但是经测试，使用 -lossless 反而对这类图片有较好的效果。
			 * 目前也不知道怎么检测图像是那种，只能通过大小来判断，以后考虑写个底层的Addon？
			 */
			if (lossy.info.size < buffer.length * WEBP_MIN_COMPRESS_RATE) {
				return lossy.data;
			}
			const lossless = await sharp(buffer)
				.webp({ quality: 100, lossless: true })
				.toBuffer({ resolveWithObject: true });

			if (lossless.info.size < buffer.length * WEBP_MIN_COMPRESS_RATE) {
				return lossless.data;
			}
			throw new ImageUnhandlableError("Webp格式无法优化该图片的大小");
		case "gif":
			return gifsicle(buffer);
		case "jpg":
			const options = {
				maxBuffer: Infinity,
				input: buffer,
				encoding: null,
			};
			return (await execa(mozjpeg, options)).stdout;
		case "png":
			return pngquant(buffer);
		default:
			throw new Error("传入了不支持的图片格式：" + targetType);
	}
}

// GIF 图片有 MagicNumber，前三字节为 GIF 这三个字
function isGif(buffer: Buffer) {
	return buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46;
}
