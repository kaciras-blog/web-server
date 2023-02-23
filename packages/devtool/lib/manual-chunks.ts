import { GetManualChunk, GetModuleInfo } from "rollup";

type GetPriority = (id: string) => { name: string; value: number };

export function mergeByPriority(getPriority: GetPriority): GetManualChunk {
	const cache = new Map<string, string[]>();

	function getChunksDFS(
		id: string,
		getModuleInfo: GetModuleInfo,
		importStack: string[] = [],
	) {
		const cached = cache.get(id);
		if (cached) {
			return cached;
		}
		if (importStack.includes(id)) {
			// circular deps!
			cache.set(id, []);
			return [];
		}

		const mod = getModuleInfo(id);
		if (!mod) {
			cache.set(id, []);
			return [];
		}

		const { importers } = mod;
		if (importers.length === 0) {
			cache.set(id, [id]);
			return [id];
		}
		const roots: string[] = [];

		for (const importer of importers) {
			roots.push(...getChunksDFS(
				importer,
				getModuleInfo,
				importStack.concat(id),
			));
		}
		if (mod.dynamicImporters.length) {
			roots.push(id);
		}

		cache.set(id, roots);
		return roots;
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
