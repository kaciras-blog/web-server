import { basename } from "path";
import sharp, { Sharp } from "sharp";
import { getLogger } from "log4js";
import mime from "mime-types";
import { BadDataError } from "../errors";
import { LoadRequest, SaveRequest } from "../WebFileService";
import { crop } from "./param-processor";
import { encodeAVIF, encodeWebp, optimize } from "./encoder";
import { ContentInfo, Optimizer } from "./CachedService";
import { FileStore } from "../FileStore";

const logger = getLogger("Image");

/**
 * 能够处理的图片格式，不支持 WebP 作为输入。
 */
const INPUT_FORMATS = ["jpg", "png", "gif", "svg"];

export default class RasterOptimizer implements Optimizer {

	private readonly store: FileStore;

	constructor(store: FileStore) {
		this.store = store;
	}

	async check(request: SaveRequest) {
		const { buffer, parameters } = request;

		let type = mime.extension(request.mimetype);
		if (!type) {
			throw new BadDataError(`不支持的 MimeType: ${type}`);
		}

		let image: Sharp | null = null;
		if (parameters.crop) {
			image = crop(sharp(buffer), parameters.crop);
		}

		if (type === "bmp") {
			type = "png";
			image = (image || sharp(buffer)).png();
		}

		if (INPUT_FORMATS.indexOf(type) < 0) {
			throw new BadDataError(`不支持的图片格式：${type}`);
		}

		return { type, buffer: image ? await image.toBuffer() : buffer };
	}

	async buildCache(name: string, info: ContentInfo) {
		const tasks: Array<Promise<void>> = [];

		const [compressed, webp, avif] = await Promise.all([
			encodeAVIF(info.buffer),
			encodeWebp(info.buffer),
			optimize(info.buffer, info.type),
		]);

		tasks.push(this.store.putCache(name, compressed, { type: info.type }));

		// 要是 WebP 格式比传统格式优化后更大就不使用 WebP
		if (webp && webp.length < compressed!.length) {
			tasks.push(this.store.putCache(name, compressed, { type: "webp" }));
		} else {
			logger.trace(`${name} 转 WebP 格式效果不佳`);
		}

		await Promise.all(tasks);
	}

	async getCache(request: LoadRequest) {
		const { name, acceptTypes } = request;
		const hash = basename(name);
		const mimetype = mime.contentType(name) as string;

		const ts: any[] = [
			{ accept: "image/avif", params: { type: "avif" } },
			{ accept: "image/webp", params: { type: "webp" } },
		];

		const candidates = ts.filter(t => acceptTypes.includes(t.accept));
		candidates.push({ accept: mimetype, params: {} });

		for (const tsc of candidates) {
			const file = await this.store.getCache(hash, tsc.params);
			if (file !== null) {
				return { file, mimetype: tsc.accept };
			}
		}
	}
}
