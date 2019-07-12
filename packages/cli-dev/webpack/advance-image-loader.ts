import { loader } from "webpack";
import * as loaderUtils from "loader-utils";
import sharp, { Region } from "sharp";

/**
 * module.exports.raw 可以用来设置加载器处理数据的类型，为 true 时处理原始字节，默认处理字符串。
 * 说明见：https://webpack.js.org/api/loaders/#raw-loader
 */
export const raw = true;

export default async function advanceImageLoader(this: loader.LoaderContext, content: Buffer) {
	if (!this.resourceQuery) {
		return content;
	}
	const query = loaderUtils.parseQuery(this.resourceQuery);
	const loaderCallback = this.async()!;

	let image = sharp(content);
	const metadata = await image.metadata();

	const extractOptions = {} as Region;

	const w = 560;
	extractOptions.width = w;
	extractOptions.left = Math.round((metadata.width! - w) / 2);
	extractOptions.height = metadata.height!;
	extractOptions.top = 0;

	if (query.format === "jpg") {
		image = image.jpeg();
	}

	loaderCallback(null, await image.extract(extractOptions).toBuffer());
}
