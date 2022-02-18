import zlib, { InputType } from "zlib";
import { promisify } from "util";
import { optimize, OptimizeOptions } from "svgo";
import { LoadRequest, SaveRequest } from "../MediaService.js";
import { MediaAttrs, Optimizer } from "../CachedService.js";
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
				removeViewBox: false,
				inlineStyles: false,
			},
		},
	}],
};

export default class SVGOptimizer implements Optimizer {

	async check(request: SaveRequest) {
		if (request.type !== "svg") {
			throw new BadDataError("文件不是 SVG");
		}
	}

	async buildCache(name: string, { buffer }: SaveRequest) {
		const optimized = optimize(buffer.toString(), svgoConfig);

		if (optimized.modernError) {
			throw new BadDataError("无法将文件作为 SVG 优化");
		}

		const promises = [];
		const { data } = optimized;

		const compress = async (algorithm: Compress, encoding: string) => {
			const compressed = await algorithm(data);
			return { data: compressed, params: { encoding, type: "svg" } };
		};

		promises.push({ data, params: { type: "svg" } });
		promises.push(compress(gzipCompress, "gzip"));

		if (data.length > BROTLI_THRESHOLD) {
			promises.push(compress(brotliCompress, "br"));
		}

		return Promise.all(promises);
	}

	select(items: MediaAttrs[], request: LoadRequest) {
		const { acceptEncodings } = request;

		return ["br", "gzip", undefined]
			.filter(e => acceptEncodings.includes(e as any))
			.map(e => items.find(i => i.encoding === e))
			.find(item => item !== undefined);
	}
}
