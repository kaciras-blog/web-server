import { GetManualChunk, GetModuleInfo } from "rollup";

type GetPriority = (id: string) => { name: string; value: number };

export function mergeByPriority(getPriority: GetPriority): GetManualChunk {
	const cache = new Map<string, string[]>();
	const importStack: string[] = [];

	function addToCache(key: string, value: string[]) {
		cache.set(key, value);
		return value;
	}

	function getChunksDFS(id: string, getModuleInfo: GetModuleInfo) {
		const cached = cache.get(id);
		if (cached) {
			return cached;
		}
		if (importStack.includes(id)) {
			return addToCache(id, []); // circular deps!
		}

		const { importers, dynamicImporters } = getModuleInfo(id)!;
		if (importers.length === 0) {
			return addToCache(id, [id]);
		}

		const chunks: string[] = [];

		if (dynamicImporters.length) {
			chunks.push(id);
		}

		importStack.push(id);
		for (const importer of importers) {
			chunks.push(...getChunksDFS(importer, getModuleInfo));
		}
		importStack.pop();

		return addToCache(id, chunks);
	}

	return (id, { getModuleInfo }) => {
		const roots = new Set(getChunksDFS(id, getModuleInfo));

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
