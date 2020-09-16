import { getLogger } from "log4js";
import sharp, { Sharp } from "sharp";
import mime from "mime-types";
import { BadDataError, ImageFilterException } from "../errors";
import LocalFileStore from "../LocalFileStore";
import { MediaSaveRequest, Params } from "../WebFileService";
import { crop } from "./param-processor";
import optimize from "./encoder";

interface ImageInfo {
	buffer: Buffer;
	type: string;
}

const logger = getLogger("Image");

/**
 * 能够处理的图片格式，不支持 WebP 作为输入。
 */
const INPUT_FORMATS = ["jpg", "png", "gif", "svg"];


async function preprocess(request: MediaSaveRequest): Promise<ImageInfo> {
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

export default class RasterImageService {

	private readonly store: LocalFileStore;

	constructor(store: LocalFileStore) {
		this.store = store;
	}

	async save(request: MediaSaveRequest) {
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
	}
}
