import { readdirSync, statSync } from "fs";
import { join, parse } from "path";
import { CachedService, DispatchService, LocalFileStore, RasterOptimizer, SVGOptimizer } from "../index.js";
import { LoadRequest, MediaService } from "../MediaService.js";

interface MediaItem {
	id: string;
	type: string;
	size: number;
	file: string;
}

const base: LoadRequest = {
	name: "__TO_BE_REPLACED__",
	parameters: {},
	codecs: [],
	acceptTypes: ["webp", "avif"],
	acceptEncodings: ["gzip", "br"],
};

async function statistics(service: MediaService, items: MediaItem[], init: LoadRequest) {
	let total = 0;
	for (const item of items) {
		const res = await service.load({ ...init, name: item.file });
		if (!res) {
			throw new Error("代码有问题");
		}
		total += res.file.size;
	}
	return total;
}

/**
 * 统计媒体资源信息，包括大小、类型、压缩率等等。
 *
 * @param dataDir 数据目录
 */
export default async function s(dataDir: any) {
	const imageStore = new LocalFileStore(dataDir, "image");
	const service = new DispatchService(
		{ "svg": new CachedService(imageStore, new SVGOptimizer()) },
		new CachedService(imageStore, new RasterOptimizer()),
	);

	const sources: MediaItem[] = [];
	const r = join(dataDir.data, "image");
	for (const file of readdirSync(r)) {
		const p = parse(file);
		const { size } = statSync(join(r, file));
		sources.push({ size, file, id: p.name, type: p.ext });
	}

	const uncompressed = sources.reduce((s, i) => s + i.size, 0);
	const d = await statistics(service, sources, base);
	console.log((d / uncompressed * 100).toFixed(3) + "%");
}

await s({
	data: "D:\\blog_data/data",
	logs: "D:\\blog_data/logs",
	cache: "D:\\blog_data/cache",
});
