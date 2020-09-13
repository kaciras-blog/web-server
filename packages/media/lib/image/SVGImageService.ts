import zlib, { InputType } from "zlib";
import { promisify } from "util";
import SVGO from "svgo";
import { getLogger } from "log4js";
import LocalFileStore from "../LocalFileStore";
import { MediaLoadRequest, MediaSaveRequest, Params } from "../WebFileService";
import { performance } from "perf_hooks";

const logger = getLogger("Image");

const gzipCompress = promisify<InputType, Buffer>(zlib.gzip);
const brotliCompress = promisify<InputType, Buffer>(zlib.brotliCompress);

const BROTLI_THRESHOLD = 1024;

export default class SVGImageService {

	private readonly svgo = new SVGO();
	private readonly store: LocalFileStore;

	constructor(store: LocalFileStore) {
		this.store = store;
	}

	async save(request: MediaSaveRequest) {
		const { buffer } = request;

		const { filename, alreadyExists } = await this.store.save(buffer, );

		if (!alreadyExists) {
			const start = performance.now();
			await this.buildCache(filename, buffer, request.parameters);
			const time = performance.now() - start;

			logger.info(`处理图片 ${filename} 用时 ${time.toFixed()}ms`);
		}

		return filename;
	}

	async buildCache(name: string, buffer: Buffer, parameters: Params) {
		const tasks = new Array(3);
		const { data } = await this.svgo.optimize(buffer.toString());

		tasks.push(this.store.putCache(name, data, {}));
		tasks.push(this.compress(data, gzipCompress, "gz"));

		if (data.length > BROTLI_THRESHOLD) {
			tasks.push(this.compress(data, brotliCompress, "br"));
		}

		return Promise.all(tasks);
	}

	private async compress(data: string, algorithm: typeof gzipCompress, encoding: string) {
		const buffer = await algorithm(data);
		return this.store.putCache(name, buffer, { encoding })
	}

	async load(request: MediaLoadRequest) {
		const { name, acceptEncodings } = request;

		if (acceptEncodings.includes("br")) {
			const cache = await this.store.getCache(name, { encoding: "br" });
			if (cache) {
				return cache;
			}
		}

		if (acceptEncodings.includes("gz")) {
			const cache = await this.store.getCache(name, { encoding: "gz" });
			if (cache) {
				return cache;
			}
		}

		return this.store.getCache(name, {});
	}
}
