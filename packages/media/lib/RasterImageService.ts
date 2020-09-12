import { getLogger } from "log4js";
import sharp, { Sharp } from "sharp";
import mime from "mime-types";
import { BadDataError } from "./errors";
import { hashName } from "./common";
import LocalFileStore from "./LocalFileStore";
import { MediaSaveRequest, Params } from "./WebFileService";

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
	const { buffer } = request;

	let type = mime.extension(request.mimetype);
	if (!type) {
		throw new BadDataError(`不支持的MimeType: ${type}`);
	}

	let image: Sharp | null = null;
	if (request.parameters.crop) {
		image = sharp(buffer).extract();
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
		const hash = hashName(info.buffer);

		const { filename, alreadyExists } = await this.store.save();

		if (!alreadyExists) {
			await this.buildCache(filename, info, request.parameters);
		}

		return filename;
	}

	async buildCache(name: string, info: ImageInfo, parameters: Params) {

	}
}