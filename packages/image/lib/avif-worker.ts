import { isMainThread, parentPort, workerData } from "worker_threads";
import { OutputInfo } from "sharp";
import wasm_avif, { AVIFModule } from "@saschazar/wasm-avif";
import defaultOptions, { EncodeOptions } from "@saschazar/wasm-avif/options";
import { ImageFilterException } from "./errors";

interface WorkerData {
	data: Buffer;
	info: OutputInfo
}

function encodeAvif(avifModule: AVIFModule) {
	const { data, info } = workerData as WorkerData;

	const options: EncodeOptions = {
		...defaultOptions,
		minQuantizer: 33,
		maxQuantizer: 63,
		minQuantizerAlpha: 33,
		maxQuantizerAlpha: 63,
	}

	try {
		const output = avifModule.encode(
			data,
			info.width,
			info.height,
			info.channels,
			options,
			1,
		);
		return Buffer.from(output);
	} catch (e) {
		if (e.name !== "RuntimeError") {
			throw e;
		}
		throw new ImageFilterException("AVIF 编码器错误");
	} finally {
		avifModule.free();
	}
}

if (isMainThread) {
	console.error("该文件只能作为 Worker 使用");
	process.exit(1);
}

wasm_avif().then(encodeAvif).then(avif => parentPort!.postMessage(avif));
