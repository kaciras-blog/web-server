import { mean, median, sum } from "simple-statistics";
import { formatSize } from "@kaciras/utilities";
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

const rows: unknown[] = [];

function flushTable(title: string) {
	console.log(title);
	console.table(rows.splice(0, rows.length));
}

class ServiceChecker {

	private readonly service: MediaService;

	constructor(service: MediaService) {
		this.service = service;
	}

	async statSize(name: string, items: MediaItem[], init?: Partial<LoadRequest>) {
		const tasks = items.map(i => this.service.load({
			...base,
			...init,
			name: i.name,
		}));
		const uncompressed = items.reduce((s, i) => s + i.size, 0);
		const sizes = (await Promise.all(tasks)).map(r => r!.file.size);

		rows.push({
			name,
			count: items.length,
			median: formatSize(median(sizes)),
			mean: formatSize(mean(sizes)),
			"ratio %": (sum(sizes) / uncompressed * 100).toFixed(2),
		});
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

/**
 * 统计媒体资源信息，包括大小、类型、压缩率等等。
 *
 * @param source 数据目录
 * @param cache 数据目录
 */
export default async function s(source: string, cache: string) {
	const store = new LocalFileStore(source, cache);
	const { sources, typeMap } = await getSources(store);

	for (const [type, list] of Object.entries(typeMap)) {
		const sizes = list.map(i => i.size);
		rows.push({
			type,
			count: list.length,
			totalSize: sum(sizes),
			mean: formatSize(mean(sizes)),
			median: formatSize(median(sizes)),
		});
	}
	flushTable("所有源文件大小统计（按类型分组）：");

	// 优化器和缓存的测试处于更低层，不该放在此处。

	const c = new ServiceChecker(new DispatchService(
		{ "svg": new CachedService(store, new SVGOptimizer()) },
		new CachedService(store, new RasterOptimizer()),
	));

	await c.statSize("全部", sources);
	await c.statSize("全部（不支持 AVIF）", sources, {
		acceptTypes: ["webp"],
	});
	await c.statSize("SVG", typeMap["svg"], base);
	await c.statSize("SVG（不支持 br）", typeMap["svg"], {
		acceptEncodings: ["gzip"],
	});

	const raster = [typeMap["jpg"], typeMap["png"], typeMap["gif"]].flat();
	await c.statSize("光栅图", raster, base);
	await c.statSize("光栅图（不支持 AVIF）", raster, {
		acceptTypes: ["webp"],
	});
	await c.statSize("光栅图（不支持 WebP）", raster, {
		acceptTypes: [],
	});
	flushTable("模拟请求，测试对不同浏览器优化的效果 - 图片：");
}

await s("D:\\blog_data/data/image", "D:\\blog_data/cache/image");
