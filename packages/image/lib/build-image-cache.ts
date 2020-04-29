import path from "path";
import fs from "fs-extra";
import { PreGenerateImageService } from "./image-service";
import { LocalFileSlot } from "./image-store";

// @formatter:off
class IgnoreOriginSlot extends LocalFileSlot {
	exists() { return Promise.resolve(false); }
	save(buffer: Buffer | string) { return Promise.resolve(); }
}
// @formatter:on

/**
 * 从原图构建图片缓存，用于清理过缓存或是迁移了图片之后生成缓存。
 *
 * 如果检测到缓存已存在则不会重新生成，要强制全部重建请删除缓存目录后再运行。
 *
 * @param directory 原图所在的目录
 */
export async function buildCache(directory: string) {
	const service = new PreGenerateImageService((key) => new IgnoreOriginSlot(directory, key));
	const names = await fs.readdir(directory);

	let count = 0;

	for (const name of names) {
		const fullPath = path.join(directory, name);

		// TODO: 设计错误，不应该把缓存目录放在原图目录里
		if ((await fs.stat(fullPath)).isDirectory()) {
			continue;
		}
		const parsed = path.parse(name);
		const type = parsed.ext.substring(1);

		if (await service.get(parsed.name, type, false, false)) {
			continue;
		}

		await service.save(await fs.readFile(fullPath), type);
		count += 1;
	}

	console.info(`一共${count}张图片的缓存生成完毕，跳过${names.length - count}张`);
}
