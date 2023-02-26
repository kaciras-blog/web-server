import { GetManualChunk, GetModuleInfo } from "rollup";

/**
 * 参数是 Chunk 的 ID，返回生成的 Chunk 名字，以及该 Chunk 的优先级（越大越重要）。
 */
type GetPriority = (id: string) => { name: string; priority: number };

/**
 * 基于优先级的模块合并，该算法会将被多个 Chunk 同步导入的模块合并到其中优先级最高的一个里面。
 *
 * # Rollup 会添加同样的功能吗？
 * 最近添加了个 experimentalMinChunkSize，但经测试对本项目的问题没用。
 * 但它还是实验性的，没准以后能用了呢；但也不知道什么时候才能稳定，所以还是得自己先搞。
 */
export function mergeByPriority(getPriority: GetPriority): GetManualChunk {
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
	function getChunksDFS(id: string, getModuleInfo: GetModuleInfo) {
		const cached = cache.get(id);
		if (cached) {
			return cached;
		}
		if (importStack.includes(id)) {
			return addToCache(id, []); // circular deps!
		}

		const { importers, dynamicImporters } = getModuleInfo(id)!;

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
			const p = getChunksDFS(importer, getModuleInfo);
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
