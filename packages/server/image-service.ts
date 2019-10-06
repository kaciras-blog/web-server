import crypto from "crypto";
import { promisify } from "util";
import sharp from "sharp";
import { brotliCompress, InputType } from "zlib";
import SVGO from "svgo";
import { getLogger } from "log4js";
import { codingFilter } from "./coding-filter";
import { ImageFilter, ImageTags, ImageUnhandlableError, InvalidImageError, runFilters } from "./image-filter";
import { ImageName, LocalFileStore } from "./image-store";


const logger = getLogger("Image");

const brotliCompressAsync = promisify<InputType, Buffer>(brotliCompress);
const svgo = new SVGO();

const filters = new Map<string, ImageFilter>();
filters.set("type", codingFilter);

/**
 * 能够处理的输入图片格式。
 * 不支持WebP作为输入，因为很难从WebP转换回传统格式。
 */
const INPUT_FORMATS = ["jpg", "png", "gif", "bmp", "svg"];

interface WebImageAttribute {
	encoding?: string;
}

interface WebImageOutput extends WebImageAttribute {
	path: string;
}

export class WebImageService {

	private readonly store: LocalFileStore;

	constructor(store: LocalFileStore) {
		this.store = store;
	}

	async save(buffer: Buffer, type: string) {
		if (type === "jpeg") {
			type = "jpg";
		}

		if (INPUT_FORMATS.indexOf(type) < 0) {
			throw new InvalidImageError("不支持的图片格式" + type);
		}

		if (type === "bmp") {
			type = "png";
			buffer = await sharp(buffer).png().toBuffer();
		}

		const hash = crypto
			.createHash("sha3-256")
			.update(buffer)
			.digest("hex");

		const name: ImageName = { name: hash, type };
		if (!await this.store.exists(name)) {
			await this.saveNewImage(name, buffer);
		}

		return `${hash}.${type}`;
	}

	async get(hash: string, type: string, webp: boolean, brotli: boolean): Promise<WebImageOutput | null> {
		const name: ImageName = { name: hash, type };
		const list: Array<{ tags: ImageTags; attrs?: WebImageAttribute }> = [];

		if (type === "svg") {
			if (brotli) {
				list.push({ tags: { encoding: "brotli" }, attrs: { encoding: "br" } });
			}
			list.push({ tags: {} });
		} else {
			if (webp) {
				list.push({ tags: { type: "webp" } });
			}
			list.push({ tags: { type } });
		}

		for (const item of list) {
			const cache = await this.store.getCache(name, item.tags);
			if (cache) {
				return Object.assign({ path: cache }, item.attrs);
			}
		}
		return null;
	}

	private async saveNewImage(name: ImageName, buffer: Buffer) {

		const buildCache = async (tags: ImageTags) => {
			try {
				const output = await runFilters(buffer, filters, tags);
				return await this.store.putCache(name, tags, output);
			} catch (error) {
				if (error instanceof ImageUnhandlableError) {
					logger.warn(error.message);
				}
				throw error;
			}
		};

		const tasks: Array<Promise<void>> = [
			this.store.save(name, buffer),
		];

		if (name.type === "svg") {
			const { data } = await svgo.optimize(buffer.toString());
			tasks.push(this.store.putCache(name, {}, data));

			if (data.length > 1024) {
				const brotli = await brotliCompressAsync(data);
				tasks.push(this.store.putCache(name, { encoding: "brotli" }, brotli));
			}
		} else {
			tasks.push(buildCache({ type: "webp" }));
			tasks.push(buildCache({ type: name.type }));
		}

		return Promise.all(tasks);
	}
}
