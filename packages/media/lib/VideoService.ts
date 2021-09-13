import { extname } from "path";
import mime from "mime-types";
import { hashName } from "./common";
import { BadDataError } from "./errors";
import { LoadRequest, SaveRequest, WebFileService } from "./WebFileService";
import { FileStore } from "./FileStore";

interface SaveParams {

	/**
	 * 变体标识，为已上传视频的文件名，该参数表示新上传的视频将作已存在视频的变体，
	 * 它将具有与其同样的访问 URL，在下载时智能选择。
	 */
	variant?: string;
}

/**
 *
 *
 * 目前不支持转码，所以仅支持两种封装格式。
 *
 * file-type 之类的使用文件头的库会更好些。
 * 但即便检查了文件头，仍不能保证内容有效，除非完整地解码。
 */
const SUPPORTED_TYPES = ["mp4", "av1"];

/**
 * 【客户端转码】
 * 由于视频转码很费时，放在服务端占用大量资源，所以暂未支持视频的优化。
 * 这里选择让用户自己转码，然后上传同一视频的多个版本。
 *
 * 需要注意视频转码是有损的，这意味着难以检测上传的多个版本是否包含相同的内容，
 * 如果上传了不同的视频作为变体，则不同的浏览器可能访问到不同的内容。
 */
export default class VideoService implements WebFileService {

	private readonly store: FileStore;

	constructor(store: FileStore) {
		this.store = store;
	}

	async load(request: LoadRequest) {
		const { name } = request;
		const file = await this.store.load(name);
		if (!file) {
			return null;
		}
		const mimetype = mime.contentType(name) as string;
		return { file, mimetype };
	}

	async save(request: SaveRequest<SaveParams>) {
		const { buffer, rawName, parameters } = request;
		const type = extname(rawName);

		if (!type || SUPPORTED_TYPES.includes(type)) {
			throw new BadDataError("不支持的视频格式：" + type);
		}

		const name = parameters.variant
			?? hashName(buffer) + "." + type;

		await this.store.save(buffer, name);

		return { url: name };
	}
}
