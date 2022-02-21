import zlib, { InputType } from "zlib";
import { promisify } from "util";
import { optimize, OptimizeOptions } from "svgo";
import { LoadRequest, SaveRequest } from "../MediaService.js";
import { MediaAttrs, Optimizer } from "../CachedService.js";
import { BadDataError } from "../errors.js";

const algorithms = {
	gzip: promisify<InputType, Buffer>(zlib.gzip),
	br: promisify<InputType, Buffer>(zlib.brotliCompress),
};

const THRESHOLD = 2048;

// SVGO 的 inlineStyles 不能处理无法内联的特性，比如媒体查询，
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

	async buildCache({ buffer }: SaveRequest) {
		const result = optimize(buffer.toString(), svgoConfig);
		if (result.modernError) {
			throw new BadDataError("无法将文件作为 SVG 优化");
		}

		const promises = [];
		const { data } = result;

		const compress = async (encoding: "gzip" | "br") => {
			const compressed = await algorithms[encoding](data);
			return { data: compressed, params: { encoding, type: "svg" } };
		};

		if (data.length > THRESHOLD) {
			promises.push(compress("br"));
			promises.push(compress("gzip"));
		}

		promises.push({ data, params: { type: "svg" } });

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
