import { basename, extname } from "path";
import { hashName } from "./common.js";
import { LoadRequest, MediaService, Params, SaveRequest } from "./MediaService.js";
import { Data, FileStore } from "./FileStore.js";

/**
 * 优化器生成的缓存的属性，将用作缓存的键，以及响应中。
 * type 和 encoding 是必要的，它们需要放在请求头中。
 */
export interface MediaAttrs extends Params {

	/**
	 * 资源的类型，例如 svg、mp4。
	 */
	type: string;

	/**
	 * 外层包装的编码，通常是 gzip 或 br。
	 */
	encoding?: string;
}

export interface MediaItem {
	data: Data;
	params: MediaAttrs;
}

/**
 * 资源优化器，用于对某个资源生成一系列优化版本，并在需要时从中选出最合适的。
 */
export interface Optimizer {

	/**
	 * 预检，判断保存请求是否能够被此优化器处理，也可以在这里调预处理求的内容。
	 * 因为缓存可能不在上传时生成，所以预检得单独拿出来。
	 *
	 * @param request 保存请求
	 */
	check(request: SaveRequest): Promise<void>;

	/**
	 * 从多个缓存中选出最适合作为响应的，如果一个都没有则返回 falsy 值。
	 *
	 * @param items 缓存参数列表
	 * @param request 请求
	 */
	select(items: MediaAttrs[], request: LoadRequest): MediaAttrs | void;

	/**
	 * 为指定的资源生成缓存（优化版本）。
	 *
	 * 当前只能一次生成资源的全部缓存，不能单独生成特定的变体，
	 * 因为资源能生成哪些优化版本这一信息需要保存，每次都尝试能否生成的话性能太差，
	 * 目前未实现这种元数据的存储功能。
	 *
	 * @param info 必要的数据
	 */
	buildCache(info: SaveRequest): Promise<MediaItem[]>;
}

/**
 * 使用预生成缓存策略的媒体服务，预生成指的是在上传时就优化资源，并将优化后的结果保存下来，
 * 在请求时从优化结果中返回最佳的文件。
 *
 * <h2>预先生 vs. 实时生成</h2>
 * 预先生成的优点是缓存一定命中，下载时无需等待。
 * 而另一种做法是实时生成，twitter 就是这种，其优点是更加灵活、允许缓存过期节省空间。
 * 考虑到个人博客不会有太多的图，而且廉价 VPS 的性能也差，所以选择了预先生成。
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

		const attrs = await optimizer.select(items as MediaAttrs[], request);
		if (!attrs) {
			return null; // 缓存中没有适合客户端的。
		}
		const file = (await store.getCache(hash, attrs))!;
		return { ...attrs, file };
	}

	/**
	 * 如果保存过程中出错，比如存储满了，则会进入不一致的状态。
	 * 这种错误无法在内部解决，故没有（也无法）使用额外措施去恢复。
	 */
	async save(request: SaveRequest) {
		const { store, optimizer } = this;

		await optimizer.check(request);
		const { buffer, type } = request;

		const hash = hashName(buffer);
		const name = hash + "." + type;

		const createNew = await store.save(name, buffer);
		if (createNew) {
			const items = await optimizer.buildCache(request);
			await store.putCaches(hash, items);
		}
		return name;
	}
}
