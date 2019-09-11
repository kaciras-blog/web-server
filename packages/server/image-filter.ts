/**
 * imagemin 对某些格式会将图片缓冲写入到临时文件，然后启动进程执行相关的图片处理程序，这方法很低效。
 */
import sharp, { Metadata, Region, ResizeOptions } from "sharp";
import Pngquant from "imagemin-pngquant";
import Gifscile from "imagemin-gifsicle";
import Mozjpeg from "imagemin-mozjpeg";
import Gif2webp from "imagemin-gif2webp";


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
const gifscile = Gifscile();
const mozjpeg = Mozjpeg();
const gif2webp = Gif2webp();

// imagemin 的 mozjpeg 没有类型定义，我也懒得折腾。
// 另外 sharp 默认构建使用的 libjpeg-turbo 虽不如 mozjpeg 但也不差吧。
// TODO: sharp 0.22.1 还不支持 webp 动画
export async function codecFilter(buffer: Buffer, targetType: string): Promise<Buffer> {
	switch (targetType) {
		case "webp":
			return isGif(buffer) ? gif2webp(buffer) : sharp(buffer).webp().toBuffer();
		case "gif":
			return gifscile(buffer);
		case "jpg":
			return mozjpeg(buffer);
		case "png":
			return pngquant(buffer);
		default:
			throw new Error("传入了不支持的图片格式：" + targetType);
	}
}

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
