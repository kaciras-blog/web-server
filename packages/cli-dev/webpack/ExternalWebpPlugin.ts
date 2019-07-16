import { Compiler, Plugin } from "webpack";
import sharp from "sharp";

/** webpack-sources：又一个类型定义跟不上版本的，还得我自己搞个 */
// @formatter:off
class WebpAssets {
	constructor(private readonly buffer: Buffer) {}
	source() { return this.buffer; }
	size() { return this.buffer.length; }
}
// @formatter:on

/**
 * 将图片转码为 webp 和 jpg 的插件，结果保存到额外的文件，文件名与源文件的输出仅扩展名不同。
 * 因为加载器没法做到自定义输出的文件名，所以这个功能只能用插件了。
 *
 * 【注意】为了保证质量，图片始终要从原图转换，而不是在 image-webpack-loader 之后二压。
 */
export default class ExternalWebpPlugin implements Plugin {

	apply(compiler: Compiler) {
		const images: Array<[string, string]> = [];

		compiler.hooks.thisCompilation.tap(ID, (compilation) => {
			compilation.hooks.moduleAsset.tap(ID, (module: any, name) => {
				const src = module.resource;
				if (/\.(jpe?g|png)$/.test(src)) {
					images.push([src, name]);
				}
			});
		});
		compiler.hooks.emit.tapPromise(ID, ({ assets }) => {
			const tasks = images.map(([src, rawPath]) => {
				const webpPath = rawPath.substring(0, rawPath.lastIndexOf(".")) + ".webp";
				return sharp(src).webp().toBuffer()
					.then((buffer) => assets[webpPath] = new WebpAssets(buffer));
			});
			return Promise.all(tasks);
		});
	}
}

const ID = ExternalWebpPlugin.name;
