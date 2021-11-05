import mime from "mime-types";
import { hashName } from "../common";
import { LoadRequest, LoadResponse, SaveRequest, WebFileService } from "../WebFileService";
import { FileStore } from "../FileStore";
import { BadDataError } from "../errors";

export interface ContentInfo {
	type: string;
	buffer: Buffer;
}

export default abstract class CachedService implements WebFileService {

	protected readonly store: FileStore;

	constructor(store: FileStore) {
		this.store = store;
	}

	async load(request: LoadRequest) {
		const { name, parameters } = request;

		if (parameters.type !== "origin") {
			return this.getCache(request);
		}

		const file = await this.store.load(name);
		const mimetype = mime.contentType(name) as string;
		return file && { file, mimetype };
	}

	async save(request: SaveRequest) {
		const info = await this.preprocess(request);
		const { buffer, type } = info;

		const hash = hashName(buffer);
		const name = hash + "." + type;

		const createNew = await this.store.save(buffer, name);
		if (createNew) {
			await this.buildCache(hash, info);
		}
		return { url: name };
	}

	protected preprocess(request: SaveRequest): Promise<ContentInfo> {
		const { buffer, mimetype } = request;
		const type = mime.extension(mimetype);
		if (type) {
			return Promise.resolve({ buffer, type });
		}
		throw new BadDataError("不支持的媒体类型：" + mimetype);
	}

	protected abstract buildCache(name: string, info: ContentInfo): Promise<void>;

	protected abstract getCache(request: LoadRequest): Promise<LoadResponse | null | undefined>;
}
