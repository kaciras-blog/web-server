import mime from "mime-types";
import { FileSelector, hashName } from "./common";
import { BadDataError } from "./errors";
import { LoadRequest, SaveRequest, WebFileService } from "./WebFileService";
import { FileStore } from "./FileStore";

const SUPPORTED_TYPES = ["mp4", "av1"];

export default class VideoService implements WebFileService {

	private readonly store: FileStore;

	constructor(store: FileStore) {
		this.store = store;
	}

	load(request: LoadRequest) {
		return FileSelector
			.for(request, this.store)
			.addCache("video/av1")
			.addOriginal()
			.selectFirstMatch();
	}

	async save(request: SaveRequest) {
		const { buffer, mimetype } = request;
		const name = hashName(buffer);
		const type = mime.extension(mimetype);

		if (!type || SUPPORTED_TYPES.includes(type)) {
			throw new BadDataError("不支持的视频格式：" + mimetype);
		}

		await this.store.putCache(buffer, name, { type });
	}
}
