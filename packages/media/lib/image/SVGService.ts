import zlib, { InputType } from "zlib";
import { basename } from "path";
import { performance } from "perf_hooks";
import { promisify } from "util";
import { optimize, OptimizeOptions } from "svgo";
import { getLogger } from "log4js";
import { LoadRequest, SaveRequest, WebFileService } from "../WebFileService";
import { FileStore } from "../FileStore";
import { hashName } from "../common";

const logger = getLogger("Image");

const gzipCompress = promisify<InputType, Buffer>(zlib.gzip);
const brotliCompress = promisify<InputType, Buffer>(zlib.brotliCompress);

const BROTLI_THRESHOLD = 1024;

// SVGO 的 inlineStyles 可能丢失样式，只能关闭。
// Rollup 官网的 Hook 图可以触发该 BUG。
// 相关的 Issue：https://github.com/svg/svgo/issues/1359
const svgoConfig: OptimizeOptions = {
	plugins: [{
		name: "preset-default",
		params: {
			overrides: {
				inlineStyles: false,
			},
		},
	}],
};

export default class SVGService implements WebFileService {

	private readonly store: FileStore;

	constructor(store: FileStore) {
		this.store = store;
	}

	async save(request: SaveRequest) {
		const { buffer, rawName } = request;

		const { name, createNew } = await this.store.save(buffer, "svg", rawName);

		if (createNew) {
			const start = performance.now();
			await this.buildCache(name, buffer);
			const time = performance.now() - start;

			logger.info(`处理图片 ${name} 用时 ${time.toFixed()}ms`);
		}

		return { url: name };
	}

	async buildCache(name: string, buffer: Buffer) {
		const { store } = this;
		const { data } = optimize(buffer.toString(), svgoConfig);

		const compress = async (algorithm: typeof gzipCompress, encoding: string) => {
			const compressed = await algorithm(data);
			return store.putCache(compressed, name, { encoding });
		};

		const tasks = new Array(3);

		if (data.length > BROTLI_THRESHOLD) {
			tasks.push(compress(brotliCompress, "br"));
		}
		tasks.push(compress(gzipCompress, "gz"));
		tasks.push(store.putCache(name, data, {}));

		return Promise.all(tasks);
	}

	async load(request: LoadRequest) {
		const { name, acceptEncodings } = request;
		const hash = basename(name);

		if (acceptEncodings.includes("br")) {
			const file = await this.store.getCache(hash, { encoding: "br" });
			if (file) {
				return { file, mimetype: "image/svg+xml", encoding: "br" };
			}
		}

		if (acceptEncodings.includes("gzip")) {
			const file = await this.store.getCache(name, { encoding: "gz" });
			if (file) {
				return { file, mimetype: "image/svg+xml", encoding: "gzip" };
			}
		}

		const file = await this.store.getCache(name, {});
		if (!file) {
			return null;
		}
		return { file, mimetype: "image/svg+xml" };
	}
}
