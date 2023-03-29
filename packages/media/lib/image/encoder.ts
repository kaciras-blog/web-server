import sharp, { WebpOptions } from "sharp";
import { execa } from "execa";
import mozjpeg from "mozjpeg";
import Gifsicle from "gifsicle";
import { BadDataError, ParamsError, ProcessorError } from "../errors.js";

const WebPLossy: WebpOptions = {
	quality: 75,
	effort: 5,
	smartSubsample: true,
};

/**
 * 判断图片数据是否是 GIF 格式，GIF 图片的前三字节为 GIF 这仨字。
 *
 * <h2>造轮子</h2>
 * 有个 is-gif 包提供同样的功能，但它使用 file-type 很多余。
 * 反观 is-png 倒是直接读取 magic number，所以 PNG 使用用 is-png 包而 GIF 自己实现。
 *
 * @param buffer 图片数据
 * @return 如果是 GIF 格式返回 true，否则 false
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
	const input = sharp(buffer, { failOn: "none" });
	const task = Promise.all([
		input.webp(WebPLossy).toBuffer(),
		input.webp({ lossless: true }).toBuffer(),
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
	const input = sharp(buffer, { failOn: "none" });
	return input.avif().toBuffer().catch(BadDataError.convert);
}

/**
 * 调用外部的图片优化工具，返回优化后的结果。
 *
 * <h2>为什么自己做</h2>
 * imagemin-* 有一些老依赖会导致 vitest 失败，而且它也就是个简单的封装。
 *
 * @param file 优化工具的执行文件路径
 * @param input 图片数据
 * @param args 执行参数
 * @throws BadDataError 如果无法优化该图片
 */
function exec(file: string, input: Buffer, args?: string[]) {
	const options = {
		maxBuffer: Infinity,
		input,
		encoding: null,
	};
	return execa(file, args, options)
		.catch(BadDataError.convert)
		.then(process => process.stdout);
}

/**
 * 对传统格式（jpg、png、gif）的优化，都是有损压缩，优化结果与原格式相同。
 *
 * TODO: imagemin 的库有多余的解码过程，以后考虑直接集成编码器到 node addon。
 *
 * @param buffer 图片
 * @param type 图片的格式
 * @return 优化后的图片
 */
export async function optimizeRaster(buffer: Buffer, type: string) {
	switch (type) {
		case "png":
			return sharp(buffer)
				.png({ palette: true })
				.toBuffer()
				.catch(BadDataError.convert);
		case "jpeg":
		case "jpg":
			return exec(mozjpeg, buffer);
		case "gif":
			if (!isGif(buffer)) {
				throw new BadDataError("不支持非 GIF 图转 GIF");
			}
			return exec(Gifsicle, buffer, [
				"--optimize=3",
				"--no-warnings",
				"--no-app-extensions",
			]);
		default:
			throw new ParamsError(`同格式优化：不支持 ${type} 类型的图片。`);
	}
}
