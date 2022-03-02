import { join, parse } from "path";
import { readdirSync, readFileSync } from "fs";
import { Presets, SingleBar } from "cli-progress";
import { ResolvedConfig } from "../../../server/lib/config.js";
import { LocalFileStore, RasterOptimizer, SVGOptimizer } from "../index.js";

const parameters = {};

const theme = Presets.shades_classic;

/**
 * 从原图构建图片缓存，用于清理过缓存或是迁移了图片之后生成缓存。
 *
 * 如果检测到缓存已存在则不会重新生成，要强制全部重建请删除缓存目录后再运行。
 */
export default async function (options: ResolvedConfig) {
	const { dataDir } = options.app;

	const store = new LocalFileStore(dataDir, "image");
	const svgOptimizer = new SVGOptimizer();
	const rasterOptimizer = new RasterOptimizer();

	const originDir = join(dataDir.data, "image");
	const names = readdirSync(originDir);

	const progress = new SingleBar({}, theme);
	progress.start(names.length, 0);

	for (const name of names) {
		const fullPath = join(originDir, name);
		const { name: hash, ext } = parse(name);
		const type = ext.substring(1);

		const optimizer = type === "svg"
			? svgOptimizer
			: rasterOptimizer;

		const request = {
			type,
			parameters,
			buffer: readFileSync(fullPath),
		};

		/*
		 * 优化器出异常可能导致生成部分缓存，且外部难以判断是否成功。
		 * 所以暂不支持跳过已生成的文件，每次都是全量。
		 */
		try {
			const items = await optimizer.buildCache(request);
			await store.putCaches(hash, items);
			progress.increment();
		} catch (e) {
			progress.stop();
			return console.error(`${hash} 的缓存生成失败`, e);
		}
	}

	progress.stop();
	console.info(`缓存构建成功，处理了 ${names.length} 张图片`);
}
