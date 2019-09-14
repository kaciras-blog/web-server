/**
 * imagemin 对某些格式会将图片缓冲写入到临时文件，然后启动进程执行相关的图片处理程序，这方法很低效。
 */
import sharp, { Metadata, Region, ResizeOptions } from "sharp";
import Pngquant from "imagemin-pngquant";
import Gifsicle from "imagemin-gifsicle";
import Mozjpeg from "imagemin-mozjpeg";
import { BaseError } from "make-error";

/**
 * 图片处理时出现的异常，表示无效的图片数据，或图片的编码不受支持。
 *
 * 【实现】JS 这垃圾语言实现个自定义异常坑真是多……
 */
export class ImageError extends BaseError {
	constructor(message?: string) { super(message); }
}

export interface ImageTags {
	readonly [key: string]: string;
}

export type ImageFilter = (buffer: Buffer, argument: string) => Promise<Buffer>;

// filters 要用 ES6 的 Map，因为它的遍历顺序是插入顺序
// TODO: 多个TAGS可以缓存中间结果
export function runFilters(buffer: Buffer, filters: Map<string, ImageFilter>, tags: ImageTags) {
	return Array.from(filters.entries())
		.filter((e) => e[0] in tags)
		.reduce((prev, [k, filter]) => prev.then((input) => filter(input, tags[k])), Promise.resolve(buffer));
}

const pngquant = Pngquant();
const gifsicle = Gifsicle({ optimizationLevel: 3 });
const mozjpeg = Mozjpeg();

export async function codecFilter(buffer: Buffer, targetType: string): Promise<Buffer> {
	switch (targetType) {
		case "webp":
			// TODO: sharp 0.23.0 不支持 webp 动画，gif2webp-bin 安装失败
			if (isGif(buffer)) {
				throw new Error("暂不支持GIF转WEBP");
			}
			// Google 官网说 libwebp 默认的质量是75，但 sharp 默认80，这里还是用 Google 的
			return sharp(buffer).webp({ quality: 75 }).toBuffer();
		case "gif":
			return gifsicle(buffer);
		case "jpg":
			return mozjpeg(buffer);
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

function IndexBannerMobile(metadata: Metadata) {
	const region = {} as Region;
	const WIDTH = 560;
	region.left = Math.round((metadata.width! - WIDTH) / 2);
	region.width = WIDTH;
	region.top = 0;
	region.height = metadata.height!;
	return { region };
}

/**
 * 定义一个配置，指定了这类图片要怎样裁剪和缩放。
 * 在URL里写这些参数实在把我恶心到了，常用的分隔符全TM是保留字符。
 */
interface CropConfig {
	region?: Region;
	resize?: ResizeOptions;
}

interface Presets {
	[key: string]: (metadata: Metadata) => CropConfig;
}

// 图片的裁剪具有响应性，不是仅靠几个坐标就能描述的
export async function cropFilter(buffer: Buffer, argument: string) {
	let image = sharp(buffer);
	const metadata = await image.metadata();

	// TEMP
	const PRESET: Presets = { IndexBannerMobile };

	const preset = PRESET[argument];
	if (!preset) {
		throw new Error("Undefined crop preset: " + argument);
	}
	const { resize, region } = preset(metadata);
	if (region) {
		image = image.extract(region);
	}
	if (resize) {
		image = image.resize(null, null, resize);
	}
	return image.toBuffer();
}
