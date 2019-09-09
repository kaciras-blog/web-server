/**
 * imagemin 对某些格式会将图片缓冲写入到临时文件，然后启动进程执行相关的图片处理程序，这方法很低效。
 */
import sharp, { Metadata, Region, ResizeOptions } from "sharp";
import PngQuant from "imagemin-pngquant";
import GifScile from "imagemin-gifsicle";
import fs from "fs-extra";
import path from "path";
import { getLogger } from "log4js";


const logger = getLogger("ImageService");

const pngquant = PngQuant();
const gifscile = GifScile();

export interface ImageTags {
	readonly [key: string]: string;
}

export interface ImageInfo {
	readonly rawHash: string;
	readonly rawType: string;
}

export class ImageData {

	private readonly value: sharp.Sharp | Buffer;

	constructor(value: sharp.Sharp | Buffer) {
		this.value = value;
	}

	async sharp() {
		return Buffer.isBuffer(this.value) ? sharp(this.value) : this.value;
	}

	async buffer() {
		return Buffer.isBuffer(this.value) ? this.value : await this.value.toBuffer();
	}
}

export type ImageProcessResult = Promise<ImageData | sharp.Sharp | Buffer>;
export type ImageProcessor = (info: ImageInfo, tags: ImageTags, input: ImageData) => ImageProcessResult;

export async function codecProcessor(info: ImageInfo, tags: ImageTags, input: ImageData): ImageProcessResult {
	if (!tags.type) {
		return input;
	}

	// imagemin 的 mozjpeg 没有类型定义，我也懒得折腾。
	// 另外 sharp 默认构建使用的 libjpeg-turbo 虽不如 mozjpeg 但也不差吧。
	switch (tags.type) {
		case "gif":
			return await gifscile(await input.buffer());
		case "jpg":
		case "bmp":
			return (await input.sharp()).jpeg();
		case "png":
			return await pngquant(await input.buffer());
		case "webp":
			return (await input.sharp()).webp();
		default:
			throw new Error("传入了不支持的图片格式：" + tags.type);
	}
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
export async function cropProcessor(info: ImageInfo, tags: ImageTags, input: ImageData): ImageProcessResult {
	if (!tags.size) {
		return input;
	}
	let image = await input.sharp();
	const metadata = await image.metadata();

	// TEMP
	const PRESET: Presets = { IndexBannerMobile };

	const preset = PRESET[tags.size];
	if (!preset) {
		throw new Error("Undefined crop preset: " + tags.size);
	}
	const { resize, region } = preset(metadata);
	if (region) {
		image = image.extract(region);
	}
	if (resize) {
		image = image.resize(null, null, resize);
	}
	return image;
}

export class LocalFileSystemCache {

	private readonly root: string;

	constructor(root: string) {
		this.root = root;
	}

	// save(tags: ImageTags, buffer: Buffer) {
	// 	return fs.writeFile(path.join(this.root, "original", `${tags.rawHash}.${tags.type}`), buffer);
	// }

	async get(info: ImageInfo, tags: ImageTags) {
		const file = this.cachePath(info, tags);
		return (await fs.pathExists(file)) ? file : null;
	}

	put(info: ImageInfo, tags: ImageTags, buffer: Buffer) {
		return fs.writeFile(this.cachePath(info, tags), buffer);
	}

	private cachePath(info: ImageInfo, tags: ImageTags) {
		const tagValues = Object.keys(tags).sort().map((key) => tags[key]);
		return path.join(this.root, "cache", ...tagValues, `${info.rawHash}.${info.rawType}`);
	}
}
