/**
 * imagemin 对某些格式会将图片缓冲写入到临时文件，然后启动进程执行相关的图片处理程序，这方法很低效。
 */
import sharp from "sharp";
import PngQuant from "imagemin-pngquant";
import GifScile from "imagemin-gifsicle";
import SVGO from "svgo";
import fs from "fs-extra";
import path from "path";
import { getLogger } from "log4js";


const logger = getLogger("ImageService");

const pngQuant = PngQuant();
const gifScile = GifScile();
const svgOptimizer = new SVGO();

// 暂时不支持 webp 作为原始图片
export class LocalImageStore {

	private readonly directory: string;

	constructor(directory: string) {
		this.directory = directory;
		fs.ensureDirSync(directory);
	}

	async save(hash: string, type: string, buffer: Buffer) {
		logger.debug("保存上传的图片:", hash);

		// 矢量图没有转码，单独处理
		if (type === "svg") {
			const optimized = await svgOptimizer.optimize(buffer.toString());
			return await fs.writeFile(this.originPath(hash, type), optimized.data);
		}

		const image = sharp(buffer);

		// 保存原图，BMP 图片保存为无损 PNG
		if (type === "bmp") {
			await image.png().toFile(this.originPath(hash, "png"));
		} else {
			await fs.writeFile(this.originPath(hash, type), buffer);
		}

		// 保存转换后的webp图片，TODO: sharp 0.22.1 还不支持webp动画
		if (type !== "gif") {
			await image.webp().toFile(this.cachePath(hash, "webp"));
		}

		// imagemin 的 mozjpeg 没有类型定义，我也懒得折腾，sharp 默认构建使用的 libjpeg-turbo 也不差吧。
		switch (type) {
			case "gif":
				return fs.writeFile(this.cachePath(hash, type), await gifScile(buffer));
			case "jpg":
			case "bmp":
				return image.jpeg().toFile(this.cachePath(hash, type));
			case "png":
				return fs.writeFile(this.cachePath(hash, type), await pngQuant(buffer));
			default:
				throw new Error("传入了不支持的图片格式：" + type);
		}
	}

	async select(hash: string, type: string, webpSupport: boolean): Promise<string | null> {
		if (type === "svg") {
			return this.originPath(hash, type);
		}

		if (webpSupport) {
			const webp = this.cachePath(hash, "webp");
			if (await fs.pathExists(webp)) {
				return webp;
			}
			logger.debug(`webp转码缓存未命中：${hash}.${type}`);
		}

		// 同样的转换，bmp 缓存为 jpg，原图为 png
		const cache = this.cachePath(hash, type === "bmp" ? "jpg" : type);
		if (await fs.pathExists(cache)) {
			return cache;
		}
		const origin = this.originPath(hash, type === "bmp" ? "png" : type);
		return (await fs.pathExists(origin)) ? origin : null;
	}

	private cachePath(hash: string, type: string) {
		return path.join(this.directory, "cache", type, `${hash}.${type}`);
	}

	private originPath(hash: string, type: string) {
		return path.join(this.directory, "origin", `${hash}.${type}`);
	}
}
