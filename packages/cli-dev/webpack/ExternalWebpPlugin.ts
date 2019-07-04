import { Compiler, Plugin } from "webpack";
import sharp from "sharp";

// @formatter:off
class WebpAssets {
	constructor(private readonly buffer: Buffer) {}
	source() { return this.buffer; }
	size() { return this.buffer.length; }
}
// @formatter:on


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
			const tasks = images.map(async ([src, rawPath]) => {
				const buffer = await sharp(src).webp().toBuffer();
				const webpPath = rawPath.substring(0, rawPath.lastIndexOf(".")) + ".webp";
				assets[webpPath] = new WebpAssets(buffer);
			});
			return Promise.all(tasks);
		});
	}
}

const ID = ExternalWebpPlugin.name;
