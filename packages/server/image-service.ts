import crypto from "crypto";
import { codecFilter, cropFilter, ImageError, ImageFilter, ImageTags, runFilters } from "./image-filter";
import sharp from "sharp";
import * as path from "path";
import fs from "fs-extra";
import { brotliCompress, InputType } from "zlib";
import { promisify } from "util";
import SVGO from "svgo";


const brotliCompressAsync = promisify<InputType, Buffer>(brotliCompress);
const svgo = new SVGO();

const rasterFilters = new Map<string, ImageFilter>();
rasterFilters.set("type", codecFilter);
rasterFilters.set("size", cropFilter);

/** 能够处理的图片格式 */
const SUPPORTED_FORMAT = ["jpg", "png", "gif", "bmp", "svg", "webp"];

interface ImageSource {
	hash: string;
	type: string;
	buffer: Buffer;
}

export class ImageService {

	private readonly store: LocalFileSystemCache;

	constructor(store: LocalFileSystemCache) {
		this.store = store;
	}

	async save(buffer: Buffer, type: string) {
		if (type === "jpeg") {
			type = "jpg";
		}
		if (SUPPORTED_FORMAT.indexOf(type) < 0) {
			throw new ImageError("不支持的图片格式" + type);
		}

		if (type === "bmp") {
			type = "png";
			buffer = await sharp(buffer).png().toBuffer();
		}

		const hash = crypto
			.createHash("sha3-256")
			.update(buffer)
			.digest("hex");

		const source = { hash, type, buffer };
		let tasks: Array<Promise<void>>;

		if (type === "svg") {
			tasks = await this.handleSvg(source);
		} else {
			tasks = this.handleRaster(source);
		}

		tasks.push(this.store.save(hash, type, buffer));
		return Promise.all(tasks).then(() => `${hash}.${type}`);
	}

	get(hash: string, type: string, tags: ImageTags) {
		return this.store.getCache(hash, type, tags);
	}

	private async handleSvg(src: ImageSource) {
		const { data } = await svgo.optimize(src.buffer.toString());
		const brotli = await brotliCompressAsync(data);

		return [
			this.store.putCache(src.hash, src.type, {}, data),
			this.store.putCache(src.hash, src.type, { type: "br" }, brotli),
		];
	}

	private handleRaster(src: ImageSource) {
		return [
			this.buildCache(src, rasterFilters, { type: "webp" }),
			this.buildCache(src, rasterFilters, { type: src.type }),
		];
	}

	private async buildCache(src: ImageSource, filters: Map<string, ImageFilter>, tags: ImageTags) {
		const output = await runFilters(src.buffer, filters, tags);
		return this.store.putCache(src.hash, src.type, tags, output);
	}
}

export class LocalFileSystemCache {

	private readonly root: string;

	constructor(root: string) {
		this.root = root;
	}

	save(hash: string, type: string, buffer: Buffer | string) {
		return fs.writeFile(this.originPath(hash, type), buffer);
	}

	load(hash: string, type: string) {
		return fs.readFile(this.originPath(hash, type));
	}

	getCache(hash: string, type: string, tags: ImageTags) {
		const file = this.cachePath(hash, type, tags);
		return fs.pathExists(file).then((exists) => exists ? file : null);
	}

	putCache(hash: string, type: string, tags: ImageTags, buffer: Buffer | string) {
		return fs.writeFile(this.cachePath(hash, type, tags), buffer);
	}

	private originPath(hash: string, type: string) {
		return path.join(this.root, "origin", `${hash}.${type}`);
	}

	private cachePath(hash: string, type: string, tags: ImageTags) {
		const tagValues = Object.keys(tags).sort().map((key) => tags[key]);
		if (tags.type) {
			type = tags.type;
		}
		return path.join(this.root, "cache", ...tagValues, `${hash}.${type}`);
	}
}
