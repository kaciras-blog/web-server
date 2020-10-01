import zlib, { InputType } from "zlib";
import { promisify } from "util";
import SVGO from "svgo";
import { getLogger } from "log4js";
import { LoadRequest, Params, SaveRequest } from "../WebFileService";
import { performance } from "perf_hooks";
import { FileStore } from "../FileStore";

const logger = getLogger("Image");

const gzipCompress = promisify<InputType, Buffer>(zlib.gzip);
const brotliCompress = promisify<InputType, Buffer>(zlib.brotliCompress);

const BROTLI_THRESHOLD = 1024;

export default class SVGService {

	private readonly svgo = new SVGO();
	private readonly store: FileStore;

	constructor(store: FileStore) {
		this.store = store;
	}

	async save(request: SaveRequest) {
		const { buffer, rawName } = request;

		const { name, createNew } = await this.store.save(buffer, "svg", rawName);

		if (createNew) {
			const start = performance.now();
			await this.buildCache(name, buffer, request.parameters);
			const time = performance.now() - start;

			logger.info(`处理图片 ${name} 用时 ${time.toFixed()}ms`);
		}

		return name;
	}

	async buildCache(name: string, buffer: Buffer, parameters: Params) {
		const { store } = this;
		const tasks = new Array(3);
		const { data } = await this.svgo.optimize(buffer.toString());

		const compress = async (algorithm: typeof gzipCompress, encoding: string) => {
			const compressed = await algorithm(data);
			return store.putCache(name, compressed, { encoding })
		}

		if (data.length > BROTLI_THRESHOLD) {
			tasks.push(compress(brotliCompress, "br"));
		}
		tasks.push(compress(gzipCompress, "gz"));
		tasks.push(store.putCache(name, data, {}));

		return Promise.all(tasks);
	}


	async load(request: LoadRequest) {
		const { name, acceptEncodings } = request;

		if (acceptEncodings.includes("br")) {
			const cache = await this.store.getCache(name, { encoding: "br" });
			if (cache) {
				return cache;
			}
		}

		if (acceptEncodings.includes("gzip")) {
			const cache = await this.store.getCache(name, { encoding: "gz" });
			if (cache) {
				return cache;
			}
		}

		return this.store.getCache(name, {});
	}
}
