/*
 * @saschazar/wasm-avif 有 BUG 只能先用 squoosh 的了。
 *
 * https://github.com/GoogleChromeLabs/squoosh
 */
import { join } from "path";
import avif_enc, { AVIFModule } from "./avif_enc";

export enum Subsample {
	YUV400 = 0,
	YUV420 = 1,
	YUV422 = 2,
	YUV444 = 3,
}

export interface EncodeOptions {
	minQuantizer: number;
	maxQuantizer: number;
	minQuantizerAlpha: number;
	maxQuantizerAlpha: number;
	tileRowsLog2: number;
	tileColsLog2: number;
	speed: number;
	subsample: Subsample;
}

const wasmUrl = join(__dirname, "avif_enc.wasm");

let emscriptenModule: Promise<AVIFModule>;

export async function encode(data: Buffer, width: number, height: number, options: EncodeOptions) {
	if (!emscriptenModule) {
		emscriptenModule = initEmscriptenModule(avif_enc, wasmUrl);
	}

	const module = await emscriptenModule;
	const result = module.encode(data, width, height, options);

	if (!result) {
		throw new Error("Encoding error");
	}

	// wasm can’t run on SharedArrayBuffers, so we hard-cast to ArrayBuffer.
	return result;
}

function initEmscriptenModule(moduleFactory: any, wasmUrl: string) {
	return new Promise<AVIFModule>((resolve) => {
		const module = moduleFactory({
			noInitialRun: true,
			locateFile(url: string) {
				if (url.endsWith(".wasm"))
					return wasmUrl;
				return url;
			},
			onRuntimeInitialized() {
				delete (module as any).then;
				resolve(module);
			},
		});
	});
}
