import crypto from "crypto";
import {
	codecProcessor,
	cropProcessor,
	ImageData,
	ImageInfo,
	ImageProcessor,
	ImageTags,
	LocalFileSystemCache,
} from "./image-converter";
import sharp from "sharp";
import * as path from "path";
import fs from "fs-extra";


const processors: ImageProcessor[] = [
	cropProcessor,
	codecProcessor,
];

export class ImageService {

	private readonly store: string;
	private readonly cache: LocalFileSystemCache;

	constructor(store: string, cache: LocalFileSystemCache) {
		this.store = store;
		this.cache = cache;
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

		const info: ImageInfo = { rawHash: hash, rawType: type };
		const filename = `${hash}.${type}`;

		const tasks: Array<Promise<void>> = [
			fs.writeFile(path.join(this.store, filename), buffer),
		];

		// TODO: sharp 0.22.1 还不支持 webp 动画
		if (type !== "gif") {
			const tags = Object.assign({}, rawTags, { type: "webp" });
			tasks.push(buildCache(info, tags, buffer).then((buf) => this.cache.put(info, tags, buf)));
		}

		const tags1 = Object.assign({}, rawTags, { type });
		tasks.push(buildCache(info, tags1, buffer).then((buf) => this.cache.put(info, tags1, buf)));

		return Promise.all(tasks).then(() => filename);
	}

	get(hash: string) {

	}
}

export async function buildCache(info: ImageInfo, tags: ImageTags, buffer: Buffer) {
	let data = new ImageData(buffer);

	for (const processor of processors) {
		const output = await processor(info, tags, data);
		data = output instanceof ImageData ? output : new ImageData(output);
	}
	return data.buffer();
}
