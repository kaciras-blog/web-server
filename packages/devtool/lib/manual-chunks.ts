import { GetManualChunk, GetModuleInfo } from "rollup";

type GetPriority = (id: string) => { name: string; value: number };

export function mergeByPriority(getPriority: GetPriority): GetManualChunk {
	const cache = new Map<string, Iterable<string>>();
	const importStack: string[] = [];

	function addToCache(key: string, value: Iterable<string>) {
		cache.set(key, value);
		return value;
	}

	/*
	 * 为优化性能，对可能出现重复元素的数据进行去重，同时在不会出现重复的地方使用数组节省内存。
	 * 故该函数返回值可能是 Set 或 Array，但都不会包含重复的元素。
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
		const roots = getChunksDFS(id, getModuleInfo);

		let highestChunk: string | undefined;
		let c = -Infinity;
		for (const chunk of roots) {
			const { name, value } = getPriority(chunk);
			if (value >= c) {
				c = value;
				highestChunk = name;
			}
		}

		if (highestChunk) {
			return highestChunk;
		}
		throw new Error("Splitting chunks failed, the algorithm has BUG");
	};
}
