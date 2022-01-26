import sharp, { WebpOptions } from "sharp";
import Pngquant from "imagemin-pngquant";
import Gifsicle from "imagemin-gifsicle";
import mozjpeg from "mozjpeg";
import { execa } from "execa";
import isPng from "is-png";
import { BadDataError, ParamsError, ProcessorError } from "../errors.js";

const pngquant = Pngquant({ strip: true });
const gifsicle = Gifsicle({ optimizationLevel: 3 });

const WebPLossy: WebpOptions = {
	quality: 75,
	smartSubsample: true,
	reductionEffort: 5,
};

/**
 * 判断图片数据是否是 GIF 格式，GIF 图片的前三字节为 GIF 这仨字。
 *
 * <h2>造轮子</h2>
 * 有个 is-gif 包提供同样的功能，但它使用 file-type 很多余。
 * 反观 is-png 倒是直接读取 magic number，所以 PNG 使用用 is-png 包而 GIF 自己实现。
 *
 * @param buffer 图片数据
 * @return 如果是GIF格式返回true，否则false
 */
function isGif(buffer: Buffer) {
	return buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46;
}

/**
 * 将图片转换为 WebP 格式，图片可能被有损压缩，也可能是无损，取决于转换效果。
 *
 * <h2>注意</h2>
 * WebP 并不一定比原图的更好，请在外部判断是否需要 WebP 格式。
 * 经测试 GIF 转 WebP 效果不理想，故暂不支持。
 *
 * @param buffer 图片数据
 * @return WebP 编码的图片
 * @see https://blog.kaciras.com/article/24/analyze-WebP-encode-options
 */
export async function encodeWebp(buffer: Buffer) {
	if (isGif(buffer)) {
		throw new ProcessorError("暂不支持 GIF 转 WebP");
	}
	const input = sharp(buffer);

	const task = Promise.all([
		input.webp({ lossless: true }).toBuffer(),
		input.webp(WebPLossy).toBuffer(),
	]);

	const [lossy, lossless] = await task.catch(BadDataError.convert);
	return lossless.length < lossy.length ? lossless : lossy;
}

/**
 * 将图片转换为 AVIF 格式。
 *
 * 经测试 GIF 转 AVIF 效果不理想，故暂不支持。
 *
 * @param buffer 图片数据
 * @return AVIF 编码的图片
 */
export async function encodeAVIF(buffer: Buffer) {
	if (isGif(buffer)) {
		throw new ProcessorError("暂不支持 GIF 转 AVIF");
	}
	return sharp(buffer).avif().toBuffer().catch(BadDataError.convert);
}

/**
 * 对传统格式（jpg、png、gif）的优化，都是有损压缩，优化结果与原格式相同。
 *
 * @param buffer 图片
 * @param type 图片的格式
 * @return 优化后的图片
 */
export async function optimizeRaster(buffer: Buffer, type: string) {
	switch (type) {
		case "gif":
			if (!isGif(buffer)) {
				throw new BadDataError("不支持非 GIF 图转 GIF");
			}
			return gifsicle(buffer).catch(BadDataError.convert);
		case "jpeg":
		case "jpg":
			// imagemin-mozjpeg 限制输入必须为 JPEG 格式所以不能用，而且它还没类型定义。
			return (await execa(mozjpeg, {
				maxBuffer: Infinity,
				input: buffer,
				encoding: null,
			}).catch(BadDataError.convert)).stdout;
		case "png":
			// 经测试，optipng 难以再压缩 pngquant 处理后的图片，故不使用。
			if (!isPng(buffer)) {
				throw new BadDataError("请先转成 PNG 再压缩");
			}
			return pngquant(buffer).catch(BadDataError.convert);
		default:
			throw new ParamsError("不支持的格式：" + type);
	}
}
