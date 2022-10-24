import zlib, { InputType } from "zlib";
import { promisify } from "util";
import { Config, optimize } from "svgo";
import { LoadRequest, SaveRequest } from "../MediaService.js";
import { MediaAttrs, Optimizer } from "../CachedService.js";
import { BadDataError } from "../errors.js";

const algorithms = {
	gzip: promisify<InputType, Buffer>(zlib.gzip),
	br: promisify<InputType, Buffer>(zlib.brotliCompress),
};

const THRESHOLD = 2048;

const ENCODINGS = ["br", "gzip"];

// SVGO 的 inlineStyles 不能处理无法内联的特性，比如媒体查询，
// Rollup 官网的 Hook 图可以触发该 BUG。
// 相关的 Issue：https://github.com/svg/svgo/issues/1359
const svgoConfig: Config = {
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
		const promises = [];
		let data: string;

		try {
			data = optimize(buffer.toString(), svgoConfig).data;
		} catch (cause) {
			throw new BadDataError("无法将文件作为 SVG 优化", { cause });
		}

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

		const encodings = ENCODINGS
			.filter(e => acceptEncodings.includes(e as any));

		return [...encodings, undefined]
			.map(e => items.find(i => i.encoding === e))
			.find(item => item !== undefined);
	}
}
