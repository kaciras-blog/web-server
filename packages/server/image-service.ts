import crypto from "crypto";
import { codecFilter, cropFilter, ImageFilter, ImageTags, runFilters } from "./image-filter";
import sharp from "sharp";
import * as path from "path";
import fs from "fs-extra";


const filters = new Map<string, ImageFilter>();
filters.set("type", codecFilter);
filters.set("size", cropFilter);

export class ImageService {

	private readonly store: LocalFileSystemCache;

	constructor(store: LocalFileSystemCache) {
		this.store = store;
	}

	async save(buffer: Buffer, type: string, rawTags: ImageTags) {
		if (type === "bmp") {
			type = "png";
			buffer = await sharp(buffer).png().toBuffer();
		}

		const hash = crypto
			.createHash("sha3-256")
			.update(buffer)
			.digest("hex");

		const tasks: Array<Promise<void>> = [
			this.store.save(hash, type, buffer),
		];

		const buildCache = async (tags: ImageTags) => {
			const merged = Object.assign({}, rawTags, tags);
			const output = await runFilters(buffer, filters, merged);
			return this.store.putCache(hash, type, merged, output);
		};

		tasks.push(buildCache({ type: "webp" }));
		tasks.push(buildCache({ type }));

		return Promise.all(tasks).then(() => `${hash}.${type}`);
	}

	get(hash: string, type: string, tags: ImageTags) {
		return this.store.getCache(hash, type, tags);
	}
}

export class LocalFileSystemCache {

	private readonly root: string;

	constructor(root: string) {
		this.root = root;
	}

	save(hash: string, type: string, buffer: Buffer) {
		return fs.writeFile(this.originPath(hash, type), buffer);
	}

	load(hash: string, type: string) {
		return fs.readFile(this.originPath(hash, type));
	}

	getCache(hash: string, type: string, tags: ImageTags) {
		const file = this.cachePath(hash, type, tags);
		return fs.pathExists(file).then((exists) => exists ? file : null);
	}

	putCache(hash: string, type: string, tags: ImageTags, buffer: Buffer) {
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
