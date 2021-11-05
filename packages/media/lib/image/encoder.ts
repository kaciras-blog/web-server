import sharp from "sharp";
import Pngquant from "imagemin-pngquant";
import Gifsicle from "imagemin-gifsicle";
import mozjpeg from "mozjpeg";
import execa from "execa";
import isPng from "is-png";
import { BadDataError, ImageFilterException, ParamsError } from "../errors";

const pngquant = Pngquant({ strip: true });
const gifsicle = Gifsicle({ optimizationLevel: 3 });

/**
 * 判断图片数据是否是 GIF 格式，GIF 图片有 MagicNumber，前三字节为 GIF 这仨字。
 *
 * 【造轮子】
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
 * 尝试将图片转换为 WebP 格式，图片可能被有损压缩。
 *
 * 【注意】
 * WebP 并不一定比原图的更好，请在外部判断是否需要 WebP 格式。
 * 经测试 GIF 转 WebP 效果不理想，故暂不支持该转换。
 *
 * @param buffer 图片数据
 * @return WebP 编码的图片
 */
export async function encodeWebp(buffer: Buffer) {
	if (isGif(buffer)) {
		throw new ImageFilterException("暂不支持 GIF 转 WebP");
	}

	const candidates: Array<Promise<Buffer>> = [];
	const input = sharp(buffer);

	candidates.push(input.webp({ quality: 75, smartSubsample: true, reductionEffort: 5 }).toBuffer());

	if (isPng(buffer)) {
		candidates.push(input.webp({ lossless: true }).toBuffer());
	}

	return (await Promise.all(candidates).catch(BadDataError.convert))
		.reduce((best, candidate) => candidate.length < best.length ? candidate : best);
}

export function encodeAVIF(buffer: Buffer) {
	return sharp(buffer).avif().toBuffer();
}

/**
 * 对传统格式的优化，都是有损压缩。
 *
 * @param buffer 图片
 * @param type 图片的格式
 * @return 优化后的图片
 */
export async function optimize(buffer: Buffer, type: string) {
	switch (type) {
		case "gif":
			if (!isGif(buffer)) {
				throw new BadDataError("不支持非GIF图转GIF");
			}
			return gifsicle(buffer).catch(BadDataError.convert);
		case "jpg":
			// imagemin-mozjpeg 限制输入必须为JPEG格式所以不能用，而且它还没类型定义。
			return (await execa(mozjpeg, {
				maxBuffer: Infinity,
				input: buffer,
				encoding: null,
			}).catch(BadDataError.convert)).stdout;
		case "png":
			// 1) pngquant 压缩效果挺好，跟 webp 压缩比差不多，那还要 webp 有鸟用？
			// 2) 经测试，optipng 难以再压缩 pngquant 处理后的图片，故不使用。
			if (!isPng(buffer)) {
				throw new BadDataError("请先转成 PNG 再压缩");
			}
			return pngquant(buffer).catch(BadDataError.convert);
		default:
			throw new ParamsError("不支持的格式：" + type);
	}
}
