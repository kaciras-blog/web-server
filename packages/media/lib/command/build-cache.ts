import { join, parse } from "path";
import { Presets, SingleBar } from "cli-progress";
import { LocalFileStore, RasterOptimizer, SVGOptimizer } from "../index.js";
import { bodyToBuffer } from "../common.js";

const parameters = {};

const theme = Presets.shades_classic;

/**
 * 从原图构建图片缓存，用于清理过缓存或是迁移了图片之后生成缓存。
 *
 * 如果检测到缓存已存在则不会重新生成，要强制全部重建请删除缓存目录后再运行。
 */
export default async function (options: any) {
	const { dataDir } = options.app;

	const store = new LocalFileStore(
		join(dataDir.data, "image"),
		join(dataDir.cache, "image"),
	);
	const svgOptimizer = new SVGOptimizer();
	const rasterOptimizer = new RasterOptimizer();

	const names = await store.list();

	const progress = new SingleBar({}, theme);
	progress.start(names.length, 0);

	for (const name of names) {
		const { name: hash, ext } = parse(name);
		const type = ext.substring(1);

		const optimizer = type === "svg"
			? svgOptimizer
			: rasterOptimizer;

		const file = await store.load(name);
		if (!file) {
			throw new Error("文件状态不一致，也可能是程序错误");
		}
		const buffer = await bodyToBuffer(file.data);

		/*
		 * 优化器出异常可能导致生成部分缓存，且外部难以判断是否成功。
		 * 所以暂不支持跳过已生成的文件，每次都是全量。
		 */
		try {
			const items = await optimizer.buildCache({
				type,
				parameters,
				buffer,
			});
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
