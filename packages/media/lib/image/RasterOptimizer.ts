import { extname } from "path";
import sharp, { Sharp } from "sharp";
import { BadDataError, ProcessorError } from "../errors.js";
import { LoadRequest, SaveRequest } from "../MediaService.js";
import { MediaAttrs, Optimizer } from "../CachedService.js";
import { crop } from "./param-processor.js";
import { encodeAVIF, encodeWebp, optimizeRaster } from "./encoder.js";

/**
 * 能够处理的图片格式，不支持 WebP 作为输入。
 */
const INPUT_FORMATS = ["jpg", "png", "gif"];

/**
 * 每张图都尝试转换成新格式，新的在前。
 */
const formats = ["avif", "webp"];

function unprocessable(e: Error) {
	if (!(e instanceof ProcessorError)) throw e;
}

export default class RasterOptimizer implements Optimizer {

	async check(request: SaveRequest) {
		const { buffer, parameters, type } = request;

		let image: Sharp | null = null;
		if (parameters.crop) {
			image = crop(sharp(buffer), parameters.crop);
		}

		if (type === "jpeg") {
			request.type = "jpg";
		}
		if (image) {
			request.buffer = await image.toBuffer();
		}

		if (INPUT_FORMATS.indexOf(request.type) < 0) {
			throw new BadDataError(`不支持的图片格式：${type}`);
		}
	}

	async buildCache({ buffer, type }: SaveRequest) {
		const [base, ...modern] = await Promise.all([
			optimizeRaster(buffer, type),
			encodeAVIF(buffer).catch(unprocessable),
			encodeWebp(buffer).catch(unprocessable),
		]);

		const cacheItems = [
			{ data: base, params: { type } },
		];

		// 筛选最佳格式，如果新格式比旧的还大就抛弃。
		let best = base.length;
		for (let i = modern.length - 1; i >= 0; i--) {
			const output = modern[i];
			type = formats[i];

			if (output && output.length < best) {
				best = output.length;
				cacheItems.push({ data: output, params: { type } });
			}
		}

		return cacheItems;
	}

	select(items: MediaAttrs[], { name, acceptTypes }: LoadRequest) {
		const ext = extname(name);

		return [...formats, ext]
			.filter(t => acceptTypes.includes(t))
			.map(t => items.find(i => i.type === t))
			.find(item => item !== undefined);
	}
}
