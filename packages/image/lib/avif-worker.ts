import { isMainThread, parentPort, workerData } from "worker_threads";
import { OutputInfo } from "sharp";
import { encode, EncodeOptions, Subsample } from "../vendor/encoder";

interface WorkerData {
	data: Buffer;
	info: OutputInfo
}

if (isMainThread) {
	console.error("该文件只能作为 Worker 使用");
	process.exit(1);
}

const options: EncodeOptions = {
	minQuantizer: 33,
	maxQuantizer: 63,
	minQuantizerAlpha: 33,
	maxQuantizerAlpha: 63,
	tileColsLog2: 0,
	tileRowsLog2: 0,
	speed: 8,
	subsample: Subsample.YUV444, // 4:4:4 无转换损失
};

const { data, info } = workerData as WorkerData;

encode(data, info.width, info.height, options).then(avif => parentPort!.postMessage(avif));
