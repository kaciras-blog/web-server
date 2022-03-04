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
 * @param source 数据目录
 * @param cache 数据目录
 */
export default async function s(source: string, cache: string) {
	const imageStore = new LocalFileStore(source, cache);
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

await s("D:\\blog_data/data/image", "D:\\blog_data/cache/image");
