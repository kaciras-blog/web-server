/*
 * 使用 Bortli 算法预压缩一些静态文件，该工具应当在静态资源打包完成后或服务器启动前调用一次，然后
 * 配合 Koa-Send 之类的中间件自动发送回复的响应。
 */
import bytes from "bytes";
import fs from "fs-extra";
import globby from "globby";
import log4js from "log4js";
import { promisify } from "util";
import { brotliCompress, InputType, gzip } from "zlib";
import { Worker, isMainThread, parentPort, workerData } from "worker_threads";
import os from "os";


const logger = log4js.getLogger("Blog");

const brotliCompressAsync = promisify<InputType, Buffer>(brotliCompress);
const gzipCompressAsync = promisify<InputType, Buffer>(gzip);

interface FileInfo {
	size: number;
	file: string;
}

/**
 * WOFF2 字体已经是Brotli压缩的，如果字体中有 WOFF2 则不需要压缩字体文件
 *
 * @param root 静态资源目录
 * @param period 小于此大小（字节）的不压缩
 */
export async function precompress (root: string, period: number) {
	console.info("预压缩静态资源...");
	const resources = await globby([root + "/**/*.{js,css,svg}", root + "/app-shell.html"]);

	const infos: FileInfo[] = [];
	let originSize = 0;

	for (const file of resources) {
		const size = (await fs.stat(file)).size;
		if (size < period) {
			continue;
		}
		originSize += size;
		infos.push({ size, file });
	}

	const cpuCount = os.cpus().length;
	if (originSize < 2 * 1024 * 1024 || cpuCount < 2) {
		await doWork(resources);
	} else {
		const tasks = partition(infos, cpuCount);
		await Promise.all(tasks.map(startWorkerThread));
	}

	console.info("静态资源压缩完成");
}

/**
 * 简单地按照大小均分文件，该算法在实际情况下分得比较均匀，但不一定是最优解。
 * 求最优解是 3-Partition 问题，该问题是NP难题。对于实际情况来说，有点误差并不会造成多大影响。
 *
 * @param infos 待均分的文件集合
 * @param count 需要均分成多少份？
 * @return 均分后的结果
 */
function partition (infos: FileInfo[], count: number) {

	interface Package {
		size: number;
		files: string[];
	}

	infos.sort((a, b) => b.size - a.size);

	const tasks: Package[] = [];
	for (let i = count; i > 0; i--) {
		tasks.push({ size: 0, files: [] });
	}

	for (const res of infos) {
		const m = tasks[0];
		const size = (m.size += res.size);
		m.files.push(res.file);

		if (size > tasks[1].size) {
			let i = tasks.findIndex((t) => t.size > size);
			if (i === -1) {
				i = tasks.length;
			}
			if (i > 0) {
				tasks.shift();
				tasks.splice(i - 1, 0, m);
			}
		}
	}
	return tasks.map((t) => t.files);
}

interface CompressResult {
	origSize: number;
	outputSize: number;
}

function startWorkerThread (tasks: string[]) {
	return new Promise<CompressResult>((resolve, reject) => {
		const worker = new Worker(__filename, {
			workerData: tasks,
		});
		worker.once("error", reject);
		worker.once("message", resolve);
	});
}

async function doWork (files: string[]) {
	for (const file of files) {
		const data = await fs.readFile(file);
		await fs.writeFile(file + ".gz", await gzipCompressAsync(data));
		await fs.writeFile(file + ".br", await brotliCompressAsync(data));
	}
}

if (!isMainThread) {
	doWork(workerData).then((result) => (parentPort as unknown as MessagePort).postMessage(result));
} else {
	precompress("D:\\Project\\Blog\\WebContent\\dist", 1024)
		.catch((err) => console.error(err));
}
