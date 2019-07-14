import { loader } from "webpack";
import * as loaderUtils from "loader-utils";
import sharp, { Metadata, Region, Sharp } from "sharp";

/**
 * module.exports.raw 可以用来设置加载器处理数据的类型，为 true 时处理原始字节，默认处理字符串。
 * 说明见：https://webpack.js.org/api/loaders/#raw-loader
 */
export const raw = true;

function IndexBannerMobile(metadata: Metadata) {
	const region = {} as Region;
	const WIDTH = 560;
	region.left = Math.round((metadata.width! - WIDTH) / 2);
	region.width = WIDTH;
	region.top = 0;
	region.height = metadata.height!;
	return region;
}

/**
 *
 */
type Preset = (metadata: Metadata) => Region;

interface Presets {
	[key: string]: Preset;
}

async function crop(this: loader.LoaderContext, content: Buffer) {
	if (!this.resourceQuery) {
		return content;
	}
	let image = sharp(content);
	const query = loaderUtils.parseQuery(this.resourceQuery);
	const metadata = await image.metadata();

	// TEMP
	const PRESET: Presets = { IndexBannerMobile };

	if (query.size) {
		const preset = PRESET[query.size];
		if (!preset) {
			throw new Error("Undefined crop preset: " + query.size);
		}
		image = image.extract(preset(metadata));
	}

	return query.format === "jpg" ? image.jpeg() : image;
}

export default async function advanceImageLoader(this: loader.LoaderContext, content: Buffer) {
	this.cacheable(true);
	const loaderCallback = this.async()!;
	let image: Sharp;

	const rv = await crop.call(this, content);
	if (Buffer.isBuffer(rv)) {
		content = rv;
		image = sharp(rv);
	} else {
		image = rv;
		content = await rv.toBuffer();
	}

	const rawPath = this.resourcePath;
	if (/\.(jpe?g|png)$/.test(rawPath)) {
		const webpPath = rawPath.substring(0, rawPath.lastIndexOf(".")) + ".webp";
		this.emitFile(webpPath, await image.webp().toBuffer(), null);
	}

	loaderCallback(null, content);
}
