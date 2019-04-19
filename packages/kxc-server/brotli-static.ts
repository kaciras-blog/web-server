/*
 * 使用 Bortli 算法预压缩一些静态文件，该工具应当在静态资源打包完成后或服务器启动前调用一次，然后
 * 配合 Koa-Send 之类的中间件自动发送回复的响应。
 */
import bytes from "bytes";
import fs from "fs-extra";
import globby from "globby";
import log4js from "log4js";
import { promisify } from "util";
import { brotliCompress, InputType } from "zlib";

const logger = log4js.getLogger("Blog");

/**
 * WOFF2 字体已经是Brotli压缩的，如果字体中有 WOFF2 则不需要压缩字体文件
 *
 * @param root 静态资源目录
 * @param period 小于此大小（字节）的不压缩
 */
export async function precompress (root: string, period: number) {
	logger.info("预压缩静态资源...");

	const resources = await globby([root + "/**/*.{js,css,svg}", root + "/app-shell.html"]);
	const brotliCompressAsync = promisify<InputType, Buffer>(brotliCompress);

	let origSize = 0;
	let outputSize = 0;

	for (const file of resources) {
		const srcStat = await fs.stat(file);
		if (srcStat.size < period) {
			continue;
		}
		const buffer = await brotliCompressAsync(await fs.readFile(file));
		origSize += srcStat.size;
		outputSize += buffer.length;
		await fs.writeFile(file + ".br", buffer);
	}

	const ratio = (outputSize * 100 / origSize).toFixed(2);
	logger.info(`预压缩完成，${bytes(origSize)} -> ${bytes(outputSize)}，压缩率：${ratio}%`);
}

precompress("D:\\Project\\Blog\\WebContent\\dist", 1024)
	.catch((err) => console.error(err));
