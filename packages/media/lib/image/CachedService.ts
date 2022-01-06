import mime from "mime-types";
import { hashName } from "../common";
import { LoadRequest, LoadResponse, SaveRequest, WebFileService } from "../WebFileService";
import { FileStore } from "../FileStore";

export interface ContentInfo {
	type: string;
	buffer: Buffer;
}

export interface Optimizer {

	/**
	 * 预检，判断保存请求是否能够被此优化器处理，也可以在这里调整请求的内容。
	 *
	 * @param request 保存请求
	 */
	check(request: SaveRequest): Promise<ContentInfo>;

	buildCache(name: string, info: ContentInfo): Promise<void>;

	getCache(request: LoadRequest): Promise<LoadResponse | null | undefined>;
}

export default class CachedService implements WebFileService {

	private readonly store: FileStore;
	private readonly optimizer: Optimizer;

	constructor(store: FileStore, optimizer: Optimizer) {
		this.store = store;
		this.optimizer = optimizer;
	}

	async load(request: LoadRequest) {
		const { name, parameters } = request;

		if (parameters.type !== "origin") {
			return this.optimizer.getCache(request);
		}

		const file = await this.store.load(name);
		if (!file) {
			return null;
		}
		return {
			file,
			mimetype: mime.contentType(name) as string,
		};
	}

	async save(request: SaveRequest) {
		const info = await this.optimizer.check(request);
		const { buffer, type } = info;

		const hash = hashName(buffer);
		const name = hash + "." + type;

		const createNew = await this.store.save(name, buffer);
		if (createNew) {
			await this.optimizer.buildCache(hash, info);
		}
		return name;
	}
}
