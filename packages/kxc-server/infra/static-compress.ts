// 已经改为webpack构建时压缩，这个模块没用了准备删除
import bytes from "bytes";
import fs from "fs-extra";
import { promisify } from "util";
import { brotliCompress, gzip, InputType } from "zlib";
import os from "os";
import globby from "globby";


const brotliCompressAsync = promisify<InputType, Buffer>(brotliCompress);
const gzipCompressAsync = promisify<InputType, Buffer>(gzip);

interface FileInfo {
	size: number;
	path: string;
}

/**
 * 使用 bortli 和 gzip 算法预压缩一些静态资源，分别生成文件名尾部附加 .br 和 .gz 的压缩文件。
 * 该模块应当在静态资源打包完成后或服务器启动前调用一次，然后配合 Koa-Send 之类的中间件自动发送压缩的资源。
 *
 * 【注意】经测试 brotli 压缩等级设置了也没什么卵用。
 * 【更新】内置库的压缩使用底层的 libuv 线程池，直接启动多个压缩任务就是多线程的，无需使用WorkerThreads。
 *
 * @param resources 要压缩的文件列表
 * @param period 小于此大小（字节）的不压缩
 */
export async function compressFiles(resources: string[], period: number) {
	const infos: FileInfo[] = [];
	let totalSize = 0;

	for (const file of resources) {
		const size = (await fs.stat(file)).size;
		if (size < period) {
			continue;
		}
		totalSize += size;
		infos.push({ size, path: file });
	}

	/** 不断从 infos 数组中取出文件执行压缩，在 infos 为空后返回，同时调用多次该函数即可启动多个压缩线程 */
	async function runCompressWorker() {
		const file = infos.pop();
		if (!file) {
			return;
		}
		const data = await fs.readFile(file.path);
		await Promise.all([
			gzipCompressAsync(data).then((buffer) => fs.writeFile(file.path + ".gz", buffer)),
			brotliCompressAsync(data).then((buffer) => fs.writeFile(file.path + ".br", buffer)),
		]);
		await runCompressWorker();
	}

	// 计算一下分配几个线程，每个线程至少处理 2M 的文件，当然不能超出CPU个数
	let threads = Math.round(totalSize / bytes("2M"));
	threads = Math.min(threads, infos.length, os.cpus().length);

	if (threads < 2) {
		await runCompressWorker();
	} else {
		infos.sort((a, b) => b.size - a.size);
		await Promise.all(new Array(threads).fill(null).map(runCompressWorker));
	}
}

/**
 * 便捷方法，搜索指定目录下可压缩的资源并压缩。压缩的文件附加 .gz 和 .br 后缀，小于 1KB 的资源不压缩。
 * 【注意】WOFF2 字体已经是Brotli压缩的，如果存在则不需要压缩字体文件
 *
 * @param directory 静态资源目录
 */
export function compressStaticDirectory(directory: string) {
	const pattern = [directory + "/**/*.{js,css,svg,html,xml}"];
	return globby(pattern).then((files) => compressFiles(files, 1024));
}
