import { join, parse } from "path";
import { readdirSync, readFileSync } from "fs-extra";
import { ResolvedConfig } from "../../../server/lib/config";
import LocalFileStore from "../LocalFileStore";
import SVGOptimizer from "../image/SVGOptimizer";
import RasterOptimizer from "../image/RasterOptimizer";

/**
 * 从原图构建图片缓存，用于清理过缓存或是迁移了图片之后生成缓存。
 *
 * 如果检测到缓存已存在则不会重新生成，要强制全部重建请删除缓存目录后再运行。
 */
export async function buildCache(options: ResolvedConfig) {
	const { dataDir } = options.app;

	const store = new LocalFileStore(dataDir, "image");
	const svgOptimizer = new SVGOptimizer(store);
	const rasterOptimizer = new RasterOptimizer(store);

	const originDir = join(dataDir.data, "image");
	const names = readdirSync(originDir);

	let count = 0;

	for (const name of names) {
		const fullPath = join(originDir, name);
		const { name: hash, ext } = parse(name);
		const type = ext.substring(1);

		const optimizer = type === "svg" ? svgOptimizer : rasterOptimizer;
		const buffer = readFileSync(fullPath);
		count += 1;

		await optimizer.buildCache(hash, { buffer, type, parameters: {} });
	}

	console.info(`生成 ${count} 张图片的缓存，跳过 ${names.length - count} 张`);
}
