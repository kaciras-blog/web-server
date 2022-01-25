import { extname } from "path";
import { hashName } from "./common.js";
import { LoadRequest, LoadResponse, MediaService, SaveRequest } from "./MediaService.js";
import { FileStore } from "./FileStore.js";

/**
 * 资源优化器，
 */
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

/**
 * 使用预生成缓存策略的媒体服务，预生成指的是在上传时就优化资源，并将优化后的结果保存下来，
 * 在请求时从优化结果中返回最佳的文件。
 *
 * <h2>预先生 vs. 实时生成</h2>
 * 预先生成的优点是缓存一定命中，下载时无需等待。
 * 而另一种做法是实时生成，twitter 就是这种，其优点是更加灵活、允许缓存过期节省空间。
 * 考虑到个人博客不会有太多的图，而且廉价 VPS 的性能也差，所以暂时选择了预先生成。
 */
export default class CachedService implements MediaService {

	private readonly store: FileStore;
	private readonly optimizer: Optimizer;

	constructor(store: FileStore, optimizer: Optimizer) {
		this.store = store;
		this.optimizer = optimizer;
	}

	/**
	 * 加载资源，默认只返回优化后的版本，可以通过 { type: "origin“ } 参数获取原始文件。
	 */
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
