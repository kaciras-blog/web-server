import sharp from "sharp";
import Pngquant from "imagemin-pngquant";
import Gifsicle from "imagemin-gifsicle";
import mozjpeg from "mozjpeg";
import execa from "execa";
import isPng from "is-png";
import { ImageUnhandlableError, InvalidImageError } from "./image-filter";


const pngquant = Pngquant({ strip: true });
const gifsicle = Gifsicle({ optimizationLevel: 3 });

/** webp 转码的最低压缩比，达不到的认为无法压缩 */
const WEBP_MIN_COMPRESS_RATE = 0.9;

/** 转换一下异常以便上层处理 */
function throwInvalidData(error: Error): never {
	throw new InvalidImageError(error.message);
}

/**
 * 判断图片数据是否是 GIF 格式，GIF 图片有 MagicNumber，前三字节为 GIF 这三个字。
 *
 * 【PS】有个 is-gif 包提供同样的功能，但它使用 file-type 很多余。反观 is-png 倒是直接读取 MagicNumber，
 * 所以PNG直接用 is-png 包而GIF自己写个函数判断。
 *
 * @param buffer 图片数据
 * @return 如果是GIF格式返回true，否则false
 */
function isGif(buffer: Buffer) {
	return buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46;
}

/**
 * 尝试将图片转换为更优化的 WebP 格式。注意 WebP 并不一定比原图的编码更好，它有更高的解码消耗，
 * 所以只有WebP能明显降低图片大小时才有意义。
 *
 * TODO: sharp 0.23.0 不支持 webp 动画，gif2webp-bin 安装失败
 *
 * @param buffer 图片数据
 * @throws 如果转换效果不理想则抛出 ImageUnhandlableError
 */
async function encodeWebp(buffer: Buffer) {
	if (isGif(buffer)) {
		throw new ImageUnhandlableError("暂不支持GIF转WEBP");
	}
	const threshold = buffer.length * WEBP_MIN_COMPRESS_RATE;

	// Google 官网说 libwebp 默认的质量 75 是比较均衡的，但 sharp 默认80，这里还是用 Google 的
	const lossy = await sharp(buffer)
		.webp({ quality: 75 })
		.toBuffer({ resolveWithObject: true })
		.catch(throwInvalidData);

	/*
	 * 测试中发现黑色背景+彩色文字的图片从PNG转WEBP之后更大了，且失真严重。
	 * 但是经测试，使用 -lossless 反而对这类图片有较好的效果。
	 * 目前也不知道怎么检测图像是那种，只能通过大小来判断，以后考虑写个底层的Addon？
	 */
	if (lossy.info.size < threshold) {
		return lossy.data;
	}
	const lossless = await sharp(buffer)
		.webp({ quality: 100, lossless: true })
		.toBuffer({ resolveWithObject: true })
		.catch(throwInvalidData);

	if (lossless.info.size < threshold) {
		return lossless.data;
	}
	throw new ImageUnhandlableError("Webp格式无法优化该图片的大小");
}

/**
 * 压缩和转码的过滤器，将输入的图片转换为指定的格式，并会应用有损优化来降低图片大小。
 *
 * @param buffer 图片数据
 * @param targetType 目标格式
 * @return 转码后的图片数据
 */
export async function codingFilter(buffer: Buffer, targetType: string) {
	switch (targetType) {
		case "gif":
			if (!isGif(buffer)) {
				throw new InvalidImageError("无效的图片数据");
			}
			return gifsicle(buffer).catch(throwInvalidData);
		case "jpg":
			const options = {
				maxBuffer: Infinity,
				input: buffer,
				encoding: null,
			};
			return (await execa(mozjpeg, options).catch(throwInvalidData)).stdout;
		case "png":
			// pngquant 压缩效果挺好，跟 webp 压缩比差不多，那还要 webp 有鸟用？
			// 经测试，optipng 难以压缩 pngquant 处理后的图片，故不使用 optipng。
			if (!isPng(buffer)) {
				throw new InvalidImageError("无效的图片数据");
			}
			return pngquant(buffer).catch(throwInvalidData);
		case "webp":
			return encodeWebp(buffer);
		default:
			throw new Error("不支持的输出格式：" + targetType);
	}
}
