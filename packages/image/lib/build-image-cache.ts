import path from "path";
import { getLogger } from "log4js";
import fs from "fs-extra";
import { PreGenerateImageService } from "./image-service";
import { LocalFileSlot } from "./image-store";

const logger = getLogger("Image");

// @formatter:off
class IgnoreOriginSlot extends LocalFileSlot {
	exists() { return Promise.resolve(false); }
	save(buffer: Buffer | string) { return Promise.resolve(); }
}
// @formatter:on

/**
 * 从原图构建图片缓存，用于清理过缓存或是迁移了图片之后生成缓存。
 *
 * @param directory 原图所在的目录
 */
export async function buildCache(directory: string) {
	const service = new PreGenerateImageService((key) => new IgnoreOriginSlot(directory, key));
	const names = await fs.readdir(directory);

	for (const name of names) {
		const file = path.join(directory, name);
		const buffer = await fs.readFile(file);
		await service.save(buffer, path.extname(name).substring(1));
	}

	logger.info(`一共${names.length}张图片的缓存生成完毕`);
}
