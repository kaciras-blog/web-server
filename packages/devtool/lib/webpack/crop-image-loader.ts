import { loader } from "webpack";
import sharp, { Metadata, Region, ResizeOptions } from "sharp";
import * as loaderUtils from "loader-utils";

// noinspection JSUnusedGlobalSymbols
export const raw = true;

function IndexBannerMobile(metadata: Metadata) {
	const region = {} as Region;
	const WIDTH = 560;
	region.left = Math.round((metadata.width! - WIDTH) / 2);
	region.width = WIDTH;
	region.top = 0;
	region.height = metadata.height!;
	return { region };
}

/**
 * 定义一个配置，指定了这类图片要怎样裁剪和缩放。
 * 在URL里写这些参数实在把我恶心到了，常用的分隔符全TM是保留字符。
 */
interface CropConfig {
	region?: Region;
	resize?: ResizeOptions;
}

interface Presets {
	[key: string]: (metadata: Metadata) => CropConfig;
}

/**
 * 裁剪和缩放图片的加载器，通过url中的参数来裁剪和缩放图片。
 * 该加载器仅支持位图，SVG等矢量图没法简单地裁剪，且无需缩放。
 *
 * @param content 图片数据
 */
export default async function CropImageLoader(this: loader.LoaderContext, content: Buffer) {
	if (!this.resourceQuery) {
		return content;
	}
	const loaderCallback = this.async()!;
	const query = loaderUtils.parseQuery(this.resourceQuery);

	let image = sharp(content);
	const metadata = await image.metadata();

	// TEMP
	const PRESET: Presets = { IndexBannerMobile };

	if (query.size) {
		const preset = PRESET[query.size];
		if (!preset) {
			throw new Error("Undefined crop preset: " + query.size);
		}
		const { resize, region } = preset(metadata);
		if (region) {
			image = image.extract(region);
		}
		if (resize) {
			image = image.resize(null, null, resize);
		}
	}
	loaderCallback(null, await image.toBuffer());
}
