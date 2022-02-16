import { basename, extname } from "path";
import { hashName } from "./common.js";
import { LoadRequest, MediaService, SaveRequest } from "./MediaService.js";
import { Data, FileStore } from "./FileStore.js";

export interface MediaAttrs extends Record<string, any> {

	/** 资源的类型，例如 svg、mp4 */
	type: string;

	/**
	 * 外层包装的编码，通常是 gzip 或 br。
	 */
	encoding?: string;
}

export interface MediaItem {
	data: Data;
	attrs: MediaAttrs;
}

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

	select(items: MediaAttrs[], request: LoadRequest): MediaAttrs | void;

	buildCache(id: string, info: SaveRequest): Promise<MediaItem[]>;
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
		const { store, optimizer } = this;
		const { name, parameters } = request;
		const ext = extname(name);

		// 如果指定了这个参数就直接返回原始文件。
		if (parameters.type === "origin") {
			const file = await this.store.load(name);
			if (!file) {
				return null;
			}
			return { file, type: ext.slice(1) };
		}

		const hash = basename(name, ext);
		const items = await store.listCache(hash);

		if (items === null) {
			return null; // 没有该文件的缓存。
		}

		const attrs = await optimizer.select(items, request);
		if (!attrs) {
			return null; // 缓存中没有适合客户端的。
		}
		const file = (await store.getCache(hash, attrs))!;
		return { ...attrs, file };
	}

	async save(request: SaveRequest) {
		const { store, optimizer } = this;

		await optimizer.check(request);
		const { buffer, type } = request;

		const hash = hashName(buffer);
		const name = hash + "." + type;

		const createNew = await store.save(name, buffer);
		if (createNew) {
			const items = await optimizer.buildCache(hash, request);
			await store.putCaches(hash, items);
		}
		return name;
	}
}
