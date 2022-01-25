import zlib, { InputType } from "zlib";
import { basename } from "path";
import { promisify } from "util";
import { optimize, OptimizeOptions } from "svgo";
import { LoadRequest, SaveRequest } from "../MediaService.js";
import { Optimizer } from "../CachedService.js";
import { FileStore } from "../FileStore.js";
import { BadDataError } from "../errors.js";

const gzipCompress = promisify<InputType, Buffer>(zlib.gzip);
const brotliCompress = promisify<InputType, Buffer>(zlib.brotliCompress);

type Compress = typeof gzipCompress;

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

export default class SVGOptimizer implements Optimizer {

	private readonly store: FileStore;

	constructor(store: FileStore) {
		this.store = store;
	}

	async check(request: SaveRequest) {
		if (request.type !== "svg") {
			throw new BadDataError("文件不是 SVG");
		}
	}

	async buildCache(name: string, { buffer }: SaveRequest) {
		const { store } = this;
		const optimized = optimize(buffer.toString(), svgoConfig);

		if (optimized.modernError) {
			throw new BadDataError("无法将文件作为 SVG 优化");
		}

		const { data } = optimized;
		const brotli = data.length > BROTLI_THRESHOLD;

		const compress = async (algorithm: Compress, encoding: string) => {
			const compressed = await algorithm(data);
			return store.putCache(name, compressed, { encoding });
		};

		await Promise.all([
			store.putCache(name, data, {}),
			compress(gzipCompress, "gz"),
			brotli && compress(brotliCompress, "br"),
		]);
	}

	async getCache(request: LoadRequest) {
		const { name, acceptEncodings } = request;
		const hash = basename(name);

		if (acceptEncodings.includes("br")) {
			const file = await this.store.getCache(hash, { encoding: "br" });
			if (file) {
				return { file, type: "svg", encoding: "br" };
			}
		}

		if (acceptEncodings.includes("gzip")) {
			const file = await this.store.getCache(name, { encoding: "gz" });
			if (file) {
				return { file, type: "svg", encoding: "gzip" };
			}
		}

		const file = await this.store.getCache(name, {});
		return file && { file, type: "svg" };
	}
}
