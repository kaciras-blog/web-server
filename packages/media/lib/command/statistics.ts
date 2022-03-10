import { mean, median, sum } from "simple-statistics";
import { hrsize } from "../common.js";
import {
	CachedService,
	DispatchService,
	FileStore,
	LocalFileStore,
	MediaService,
	RasterOptimizer,
	SVGOptimizer,
} from "../index.js";
import { LoadRequest } from "../MediaService.js";

interface MediaItem {
	id: string;
	type: string;
	size: number;
	name: string;
}

const base: LoadRequest = {
	name: "__TO_BE_REPLACED__",
	parameters: {},
	codecs: [],
	acceptTypes: ["webp", "avif"],
	acceptEncodings: ["gzip", "br"],
};

class ServiceChecker {

	private readonly service: MediaService;

	constructor(service: MediaService) {
		this.service = service;
	}

	async statSize(items: MediaItem[], init: LoadRequest) {
		const tasks = items.map(i => this.service.load({
			...init,
			name: i.name,
		}));
		const uncompressed = items.reduce((s, i) => s + i.size, 0);
		const sizes = (await Promise.all(tasks)).map(r => r!.file.size);

		return {
			name,
			median: hrsize(median(sizes)),
			mean: hrsize(mean(sizes)),
			"ratio %": (sum(sizes) / uncompressed * 100).toFixed(2),
		};
	}
}

async function getSources(store: FileStore) {
	const sources: MediaItem[] = [];
	const typeMap: Record<string, MediaItem[]> = {};

	for (const name of await store.list()) {
		const [id, type] = name.split(".", 2);
		const { size } = (await store.load(name))!;
		const item = { size, name, id, type };

		sources.push(item);
		(typeMap[type] ??= []).push(item);
	}

	return { sources, typeMap };
}

async function getCaches(store: FileStore, sources: MediaItem[]) {
	const caches = [];
	for (const { id } of sources) {
		const params = await store.listCache(id);
		for (const d of params) {
			const c = await store.getCache(id, d);
			caches.push({});
		}
	}
}

async function printTable(title: string, rows: any) {
	console.log(title);
	console.table(await rows);
}

/**
 * 统计媒体资源信息，包括大小、类型、压缩率等等。
 *
 * @param source 数据目录
 * @param cache 数据目录
 */
export default async function s(source: string, cache: string) {
	const store = new LocalFileStore(source, cache);
	const { sources, typeMap } = await getSources(store);

	const s = Object.entries(typeMap).map(([type, list]) => {
		const sizes = list.map(i => i.size);
		return {
			type: type,
			count: list.length,
			totalSize: sum(sizes),
			mean: hrsize(mean(sizes)),
			median: hrsize(median(sizes)),
		};
	});
	await printTable("资源大小统计（按类型分组）：", s);


	await printTable("缓存大小统计：", s);


	const service = new DispatchService(
		{ "svg": new CachedService(store, new SVGOptimizer()) },
		new CachedService(store, new RasterOptimizer()),
	);
	const c = new ServiceChecker(service);
	c.statSize(typeMap["svg"], base);

	//
	// await statistics("All features", sources, base);
	// await statistics("Not support AVIF", sources, {
	// 	...base,
	// 	acceptTypes: ["webp"],
	// });
	//
	// console.table(t);
}

await s("D:\\blog_data/data/image", "D:\\blog_data/cache/image");
