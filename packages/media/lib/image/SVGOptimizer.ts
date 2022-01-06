import zlib, { InputType } from "zlib";
import { basename } from "path";
import { promisify } from "util";
import { optimize, OptimizeOptions } from "svgo";
import { LoadRequest, SaveRequest } from "../WebFileService";
import { ContentInfo, Optimizer } from "./CachedService";
import { FileStore } from "../FileStore";
import { BadDataError } from "../errors";

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
		const { buffer, mimetype } = request;
		if (mimetype !== "image/svg+xml") {
			throw new BadDataError("文件不是 SVG");
		}
		return { buffer, type: "svg" };
	}

	async buildCache(name: string, { buffer }: ContentInfo) {
		const { store } = this;
		const { data } = optimize(buffer.toString(), svgoConfig);

		const compress = async (algorithm: typeof gzipCompress, encoding: string) => {
			const compressed = await algorithm(data);
			return store.putCache(name, compressed, { encoding });
		};

		const brotli = data.length > BROTLI_THRESHOLD;

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
		return file && { file, mimetype: "image/svg+xml" };
	}
}
