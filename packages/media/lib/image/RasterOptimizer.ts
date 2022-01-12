import { basename, extname } from "path";
import sharp, { Sharp } from "sharp";
import { getLogger } from "log4js";
import { BadDataError } from "../errors";
import { LoadRequest, SaveRequest } from "../MediaService";
import { crop } from "./param-processor";
import { encodeAVIF, encodeWebp, optimize } from "./encoder";
import { Optimizer } from "../CachedService";
import { FileStore } from "../FileStore";

const logger = getLogger("Image");

/**
 * 能够处理的图片格式，不支持 WebP 作为输入。
 */
const INPUT_FORMATS = ["jpg", "png", "gif"];

const ts: any[] = [
	{ accept: "avif", params: { type: "avif" } },
	{ accept: "webp", params: { type: "webp" } },
];

export default class RasterOptimizer implements Optimizer {

	private readonly store: FileStore;

	constructor(store: FileStore) {
		this.store = store;
	}

	async check(request: SaveRequest) {
		const { buffer, parameters, type } = request;

		let image: Sharp | null = null;
		if (parameters.crop) {
			image = crop(sharp(buffer), parameters.crop);
		}

		if (type === "jpeg") {
			request.type = "jpg";
		}
		if (image) {
			request.buffer = await image.toBuffer();
		}

		if (INPUT_FORMATS.indexOf(request.type) < 0) {
			throw new BadDataError(`不支持的图片格式：${type}`);
		}
	}

	async buildCache(name: string, info: SaveRequest) {
		const tasks: Array<Promise<void>> = [];

		const [avif, webp, base] = await Promise.all([
			encodeAVIF(info.buffer),
			encodeWebp(info.buffer),
			optimize(info.buffer, info.type),
		]);

		tasks.push(this.store.putCache(name, base, { type: info.type }));

		let best = base;

		// 筛选最佳格式，如果新格式比旧的还大就抛弃。
		if (webp.length < best.length) {
			best = webp;
			tasks.push(this.store.putCache(name, webp, { type: "webp" }));
		} else {
			logger.trace(`${name} 转 WebP 格式效果不佳`);
		}

		if (avif.length < best.length) {
			tasks.push(this.store.putCache(name, avif, { type: "avif" }));
		} else {
			logger.trace(`${name} 转 AVIF 格式效果不佳`);
		}

		await Promise.all(tasks);
	}

	async getCache(request: LoadRequest) {
		const { name, acceptTypes } = request;
		const type = extname(name);
		const hash = basename(name, type);

		for (const tsc of ts) {
			if (!acceptTypes.includes(tsc.accept)) {
				continue;
			}
			const file = await this.store.getCache(hash, tsc.params);
			if (file !== null) {
				return { file, type: tsc.accept };
			}
		}

		const file = await this.store.getCache(hash, {});
		return file && { file, type: type.slice(1) };
	}
}
