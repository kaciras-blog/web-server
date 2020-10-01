import { getLogger } from "log4js";
import sharp, { Sharp } from "sharp";
import mime from "mime-types";
import { BadDataError, ImageFilterException } from "../errors";
import { LoadRequest, Params, SaveRequest, WebFileService } from "../WebFileService";
import { crop } from "./param-processor";
import optimize from "./encoder";
import { FileStore } from "../FileStore";
import SVGService from "./SVGImageService";

interface ImageInfo {
	buffer: Buffer;
	type: string;
}

const logger = getLogger("Image");

/**
 * 能够处理的图片格式，不支持 WebP 作为输入。
 */
const INPUT_FORMATS = ["jpg", "png", "gif", "svg"];


async function preprocess(request: SaveRequest): Promise<ImageInfo> {
	const { buffer, parameters } = request;

	let type = mime.extension(request.mimetype);
	if (!type) {
		throw new BadDataError(`不支持的MimeType: ${type}`);
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

class ImageService implements WebFileService {

	private svgService: SVGService;
	private rasterService: RasterService;

	constructor(store: FileStore) {
		this.svgService = new SVGService(store);
		this.rasterService = new RasterService(store);
	}

	save(request: SaveRequest) {
		if (request.mimetype === "image/svg+xml") {
			return this.saveSvg(request);
		} else {
			return this.saveRaster(request);
		}
	}

	load(request: LoadRequest) {
		return Promise.resolve(null);
	}

	private saveSvg(request: SaveRequest) {

	}

	private saveRaster(request: SaveRequest) {

	}
}

export default class RasterService {

	private readonly store: FileStore;

	constructor(store: FileStore) {
		this.store = store;
	}

	async save(request: SaveRequest) {
		const info = await preprocess(request);
		const { buffer, type } = info;

		const { name, createNew } = await this.store.save(buffer, type, request.rawName);

		if (createNew) {
			await this.buildCache(name, info, request.parameters);
		}

		return name;
	}

	async buildCache(name: string, info: ImageInfo, parameters: Params) {
		const tasks: Array<Promise<void>> = [];

		async function encodeRasterImage(type: string) {
			try {
				return await optimize(info.buffer, type);
			} catch (error) {
				if (!(error instanceof ImageFilterException)) {
					throw error;
				}
				logger.debug(`${error.message}，name=${name}`);
			}
		}

		const [compressed, webp] = await Promise.all([
			encodeRasterImage(info.type),
			encodeRasterImage("webp"),
		]);

		// TODO: 下一版改为候选模式
		tasks.push(this.store.putCache(compressed, name, { type: info.type }));

		// 要是 WebP 格式比传统格式优化后更大就不使用 WebP
		if (webp && webp.length < compressed!.length) {
			tasks.push(this.store.putCache(compressed, name, { type: "webp" }));
		} else {
			logger.trace(`${name} 转WebP格式效果不佳`);
		}

		await Promise.all(tasks);
	}
}
