/**
 * imagemin 对某些格式会将图片缓冲写入到临时文件，然后启动进程执行相关的图片处理程序，这方法很低效。
 */
import sharp from "sharp";
import Pngquant from "imagemin-pngquant";
import Gifsicle from "imagemin-gifsicle";
import mozjpeg from "mozjpeg";
import execa from "execa";
import { ImageUnhandlableError } from "./image-filter";

const pngquant = Pngquant();
const gifsicle = Gifsicle({ optimizationLevel: 3 });

/** webp 转码的最低压缩比，达不到的认为无法压缩 */
const WEBP_MIN_COMPRESS_RATE = 0.9;

export async function codingFilter(buffer: Buffer, targetType: string) {
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
			// pngquant 压缩效果挺好，跟 webp 压缩比差不多，那还要 webp 有鸟用？
			return pngquant(buffer);
		default:
			throw new Error("不支持的输出格式：" + targetType);
	}
}

// GIF 图片有 MagicNumber，前三字节为 GIF 这三个字
function isGif(buffer: Buffer) {
	return buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46;
}
