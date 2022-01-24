import { extname } from "path";
import { hashName } from "./common.js";
import { LoadRequest, LoadResponse, MediaService, SaveRequest } from "./MediaService.js";
import { FileStore } from "./FileStore.js";

export interface Optimizer {

	/**
	 * 预检，判断保存请求是否能够被此优化器处理，也可以在这里调整请求的内容。
	 *
	 * @param request 保存请求
	 */
	check(request: SaveRequest): Promise<void>;

	buildCache(name: string, info: SaveRequest): Promise<void>;

	getCache(request: LoadRequest): Promise<LoadResponse | null | undefined>;
}

export default class CachedService implements MediaService {

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
		return { file, type: extname(name).slice(1) };
	}

	async save(request: SaveRequest) {
		await this.optimizer.check(request);
		const { buffer, type } = request;

		const hash = hashName(buffer);
		const name = hash + "." + type;

		const createNew = await this.store.save(name, buffer);
		if (createNew) {
			await this.optimizer.buildCache(hash, request);
		}
		return name;
	}
}
