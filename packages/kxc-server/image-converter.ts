/**
 * imagemin 对某些格式会将图片缓冲写入到临时文件，然后启动进程执行相关的图片处理程序，这方法很低效。
 */
import sharp, { Sharp } from "sharp";
import PngQuant from "imagemin-pngquant";
import SVGO from "svgo";
import fs from "fs-extra";
import path from "path";

export interface ResizeOptions {
	readonly width?: number;
	readonly height?: number;
	readonly force?: boolean;
}

export interface ImageEntity {
	hash: string;
	type: string;
	buffer: Buffer;
}

const svgOptimizer = new SVGO();
const pngquant = PngQuant();

async function applyResize(image: Sharp, options: ResizeOptions) {
	const { width, height, force } = options;
	if (force) {
		return image.resize(width, height, { fit: "outside" });
	}
	const source = await image.metadata();
	if (width && source.width! > width) {
		return image.resize(width, null, { fit: "outside" });
	}
	if (height && source.height! > height) {
		return image.resize(null, height, { fit: "outside" });
	}
	return image;
}

export class LocalImageStore {

	private readonly directory: string;

	constructor(directory: string) {
		this.directory = directory;
	}

	async save(input: ImageEntity) {
		const { hash, buffer, type } = input;

		// 矢量图没有压缩和缩放，单独处理
		if (type === "svg") {
			const optimized = await svgOptimizer.optimize(buffer.toString());
			return await fs.writeFile(this.originPath(hash, type), optimized.data);
		}

		let image = sharp(buffer);

		// 保存原图，BMP 图片保存为无损 PNG
		if (type === "bmp") {
			await image.png().toFile(this.originPath(hash, "png"));
		} else {
			await fs.writeFile(this.originPath(hash, type), buffer);
		}

		// 保存转换后的图片
		if (type !== "webp") {
			await image.webp().toFile(this.cachePath(hash, "origin", "webp"));
		}

		switch (input.type) {
			case "jpg":
			case "bmp":
				image = image.jpeg();
				break;
			case "png":
				image = await image.png();
				// pngquant
				break;
		}
		// TODO
	}

	select(hash: string): Buffer {
		throw new Error();
	}

	private cachePath(hash: string, scale: string, type: string) {
		return path.join(this.directory, scale, type, `${hash}.${type}`);
	}

	private originPath(hash: string, type: string) {
		return path.join(this.directory, "origin", `${hash}.${type}`);
	}
}
