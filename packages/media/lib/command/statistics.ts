import { mean, median, sum } from "simple-statistics";
import { CachedService, DispatchService, LocalFileStore, RasterOptimizer, SVGOptimizer } from "../index.js";
import { LoadRequest } from "../MediaService.js";
import { hrsize } from "../common.js";

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


/**
 * 统计媒体资源信息，包括大小、类型、压缩率等等。
 *
 * @param source 数据目录
 * @param cache 数据目录
 */
export default async function s(source: string, cache: string) {
	const store = new LocalFileStore(source, cache);
	const service = new DispatchService(
		{ "svg": new CachedService(store, new SVGOptimizer()) },
		new CachedService(store, new RasterOptimizer()),
	);

	const sources: MediaItem[] = [];
	const files = await store.list();
	for (const name of files) {
		const [id, type] = name.split(".", 2);
		const { size } = (await store.load(name))!;
		sources.push({ size, name, id, type });
	}

	const t: any[] = [];

	// const items = sources.filter(i => i.type === type);

	async function statistics(name: string, items: MediaItem[], init: LoadRequest) {

		const tasks = items.map(i => service.load({
			...init,
			name: i.name,
		}));
		const sizes = (await Promise.all(tasks)).map(r => r!.file.size);

		const uncompressed = items.reduce((s, i) => s + i.size, 0);

		t.push({
			name,
			median: hrsize(median(sizes)),
			mean: hrsize(mean(sizes)),
			"ratio %": (sum(sizes) / uncompressed * 100).toFixed(2),
		});
	}

	await statistics("All features", sources, base);
	await statistics("Not support AVIF", sources, {
		...base,
		acceptTypes: ["webp"],
	});

	console.table(t);
}

await s("D:\\blog_data/data/image", "D:\\blog_data/cache/image");
