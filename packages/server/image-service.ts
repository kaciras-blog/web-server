import crypto from "crypto";
import sharp from "sharp";
import { brotliCompress, InputType } from "zlib";
import { promisify } from "util";
import SVGO from "svgo";
import {
	codecFilter,
	ImageFilter,
	ImageTags,
	ImageUnhandlableError,
	InvalidImageError,
	runFilters,
} from "./image-filter";
import { ImageName, LocalFileStore } from "./image-store";
import { getLogger } from "log4js";


const logger = getLogger("Image");

const brotliCompressAsync = promisify<InputType, Buffer>(brotliCompress);
const svgo = new SVGO();

const filters = new Map<string, ImageFilter>();
filters.set("type", codecFilter);

/** 能够处理的图片格式 */
const SUPPORTED_FORMAT = ["jpg", "png", "gif", "bmp", "svg", "webp"];

interface WebImageOutput {
	path: string;
	encoding?: string;
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

		if (SUPPORTED_FORMAT.indexOf(type) < 0) {
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

		const name = { hash, type };
		if (!await this.store.exists(name)) {
			await this.saveNewImage(name, buffer);
		}

		return `${hash}.${type}`;
	}

	async get(hash: string, type: string, webp: boolean, brotli: boolean): Promise<WebImageOutput | null> {
		const name = { hash, type };
		const list = [];

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
			} catch (e) {
				if (e instanceof ImageUnhandlableError) {
					logger.warn(e.message);
				} else {
					throw e;
				}
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
