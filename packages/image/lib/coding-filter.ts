import sharp from "sharp";
import Pngquant from "imagemin-pngquant";
import Gifsicle from "imagemin-gifsicle";
import mozjpeg from "mozjpeg";
import execa from "execa";
import isPng from "is-png";
import { BadImageError, FilterArgumentError, ImageFilterException } from "./errors";

const pngquant = Pngquant({ strip: true });
const gifsicle = Gifsicle({ optimizationLevel: 3 });

/** webp 转码的最低压缩比，达不到的认为无法压缩 */
const WEBP_MIN_COMPRESS_RATE = 0.9;

/** 转换一下异常以便上层处理 */
function throwInvalidData(error: Error): never {
	throw new BadImageError(error.message);
}

/**
 * 判断图片数据是否是 GIF 格式，GIF 图片有 MagicNumber，前三字节为 GIF 这仨字。
 *
 * 【造轮子】
 * 有个 is-gif 包提供同样的功能，但它使用 file-type 很多余。反观 is-png 倒是直接读取 MagicNumber，
 * 所以PNG直接用 is-png 包而GIF自己写个函数判断。
 *
 * @param buffer 图片数据
 * @return 如果是GIF格式返回true，否则false
 */
function isGif(buffer: Buffer) {
	return buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46;
}

/**
 * 尝试将图片转换为更优化的 WebP 格式。
 * WebP 并不一定比原图的编码更好，它有更高的解码消耗，所以只有 WebP 能明显降低图片大小时才有意义。
 *
 * TODO: sharp 0.23.0 不支持 webp 动画，gif2webp-bin 安装失败
 *
 * @param buffer 图片数据
 * @throws 如果转换效果不理想则抛出 ImageFilterException
 */
async function encodeWebp(buffer: Buffer) {
	if (isGif(buffer)) {
		throw new ImageFilterException("暂不支持GIF转WEBP");
	}
	const input = sharp(buffer);

	/*
	 * 测试中发现黑色背景+彩色文字的图片从PNG转WEBP之后更大了，且失真严重。
	 * 但是使用 -lossless 反而对这类图片有较好的效果。
	 * 目前也不知道怎么检测图像是那种，只能比较有损和无损两种结果选出最好的。
	 *
	 * 【官网也有对此问题的描述】
	 * https://developers.google.com/speed/webp/faq#can_a_webp_image_grow_larger_than_its_source_image
	 */
	const candidates: Promise<Buffer>[] = [

		// Google 官网说 libwebp 默认的质量 75 是比较均衡的，但 sharp 默认80，这里还是用 Google 的
		input.webp({ quality: 75 }).toBuffer(),
	];

	if (isPng(buffer)) {
		candidates.push(input.webp({ lossless: true }).toBuffer())
	}

	return (await Promise.all(candidates))
		.reduce((best, candidate) => candidate.length < best.length ? candidate : best);
}

/**
 * 压缩和转码的过滤器，将输入的图片转换为指定的格式，并会应用合适的有损压缩来降低图片大小。
 *
 * @param buffer 图片数据
 * @param targetType 目标格式
 * @return 转码后的图片数据
 */
export default async function codingFilter(buffer: Buffer, targetType: string) {
	switch (targetType) {
		case "gif":
			if (!isGif(buffer)) {
				throw new BadImageError("不支持非GIF图转GIF");
			}
			return gifsicle(buffer).catch(throwInvalidData);
		case "jpg":
			// imagemin-mozjpeg 限制输入必须为JPEG格式所以不能用，而且它还没类型定义。
			return (await execa(mozjpeg, {
				maxBuffer: Infinity,
				input: buffer,
				encoding: null,
			}).catch(throwInvalidData)).stdout;
		case "png":
			// 1) pngquant 压缩效果挺好，跟 webp 压缩比差不多，那还要 webp 有鸟用？
			// 2) 经测试，optipng 难以再压缩 pngquant 处理后的图片，故不使用。
			if (!isPng(buffer)) {
				throw new BadImageError("请先转成PNG再压缩");
			}
			return pngquant(buffer).catch(throwInvalidData);
		case "webp":
			return encodeWebp(buffer);
		default:
			throw new FilterArgumentError("不支持的输出格式：" + targetType);
	}
}
