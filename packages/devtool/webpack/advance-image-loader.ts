import { loader } from "webpack";
import * as loaderUtils from "loader-utils";
import sharp from "sharp";
import imagemin from "imagemin";
import gifsicle from "imagemin-gifsicle";
import pngquant from "imagemin-pngquant";
// @ts-ignore
import mozjpeg from "imagemin-mozjpeg";
// @ts-ignore
import optipng from "imagemin-optipng";

const plugins = [
	gifsicle(),
	mozjpeg(),
	pngquant(),
	optipng(),
];

/**
 * module.exports.raw 可以用来设置加载器处理数据的类型，为 true 时处理原始字节，默认处理字符串。
 * 说明见：https://webpack.js.org/api/loaders/#raw-loader
 */
export const raw = true;

/**
 * 压缩优化图片的加载器，能够转换图片格式、压缩图片、生成额外的webp格式文件。
 *
 * 该加载器仅支持位图，矢量图不适用于上述功能。
 * 该加载器已经包含了 image-webpack-loader 的功能，不要再添加它。
 *
 * @param content 图片数据
 */
export default async function advanceImageLoader(this: loader.LoaderContext, content: Buffer) {
	this.cacheable(true);
	const options = loaderUtils.getOptions(this);

	const loaderCallback = this.async()!;
	const image = sharp(content);

	if (this.resourceQuery) {
		const query = loaderUtils.parseQuery(this.resourceQuery);
		if (query.format === "jpg") {
			content = await image.jpeg().toBuffer();
		}
	}
	content = await imagemin.buffer(content, { plugins });

	const rawPath = this.resourcePath;
	if (options.name && /\.(jpe?g|png)$/.test(rawPath)) {

		// 输出文件的 HASH 值是由这里传递的 content 计算的，使用传递给下一个加载器
		const webpPath = loaderUtils.interpolateName(this, options.name, { content });
		this.emitFile(webpPath, await image.webp().toBuffer(), undefined);
	}

	loaderCallback(null, content);
}
