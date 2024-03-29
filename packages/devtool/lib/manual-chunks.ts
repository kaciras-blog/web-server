import { basename } from "path";
import { GetManualChunk, GetModuleInfo } from "rollup";

/**
 * 参数是 Chunk 的 ID，返回生成的 Chunk 名字，以及该 Chunk 的优先级（越大越重要）。
 */
type GetPriorityFn = (id: string) => { name: string; priority: number };

/**
 * 匹配 Chunk id 的正则和名字二元组，越靠后的优先级越高。
 * 没有匹配的 Chunk 将一默认的方式处理。
 */
type PriorityList = Array<[RegExp, string]>;

export type PriorityArg = GetPriorityFn | PriorityList

function useList(this: PriorityList, id: string) {
	const i = this.findIndex(x => x[0].test(id));
	return i !== -1
		? { name: this[i][1], priority: i }
		: { name: basename(id), priority: -1 };
}

/**
 * 基于优先级的模块合并，该算法会将被多个 Chunk 同步导入的模块合并到其中优先级最高的一个里面。
 * 该算法能够减少 Chunk 的数量，但会导致低优先级的 Chunk 消耗额外的流量。
 *
 * 该功能占用 Rollup 的 manualChunks 选项，无法与 splitVendorChunkPlugin 一起用。
 *
 * # Rollup 会添加同样的功能吗？
 * 最近添加了个 experimentalMinChunkSize，但经测试对本项目的问题没用。
 * 但它还是实验性的，没准以后能用了呢；但也不知道什么时候才能稳定，所以还是得自己先搞。
 */
export function mergeByPriority(priority: PriorityArg): GetManualChunk {
	const getPriority = typeof priority === "function"
		? priority
		: useList.bind(priority);

	const cache = new Map<string, Iterable<string>>();
	const importStack: string[] = [];

	function addToCache(key: string, value: Iterable<string>) {
		cache.set(key, value);
		return value;
	}

	/*
	 * 为优化性能，对可能出现重复元素的数据立即去重，同时在不会出现重复的地方使用数组节省内存。
	 * 故该函数返回值可能是 Set 或 Array，且都不包含重复的元素。
	 */
	function getChunksDFS(id: string, getInfo: GetModuleInfo) {
		const cached = cache.get(id);
		if (cached) {
			return cached;
		}
		if (importStack.includes(id)) {
			return addToCache(id, []); // circular deps!
		}

		const { importers, dynamicImporters } = getInfo(id)!;

		// 入口模块是 chunk，且无需向上搜索了，直接返回。
		if (importers.length === 0) {
			return addToCache(id, [id]);
		}

		const chunks = new Set<string>();
		if (dynamicImporters.length) {
			chunks.add(id);
		}
		importStack.push(id);
		for (const importer of importers) {
			const p = getChunksDFS(importer, getInfo);
			for (const chunk of p) chunks.add(chunk);
		}
		importStack.pop();
		return addToCache(id, chunks);
	}

	return (id, { getModuleInfo }) => {
		const chunks = getChunksDFS(id, getModuleInfo);

		let highestChunk: string | undefined;
		let p = -Infinity;
		for (const chunk of chunks) {
			const { name, priority } = getPriority(chunk);
			if (priority >= p) {
				p = priority;
				highestChunk = name;
			}
		}

		if (highestChunk) {
			return highestChunk;
		}
		throw new Error("Splitting chunks failed, the algorithm has BUG");
	};
}
