import { Compiler, Plugin } from "webpack";
import codingFilter from "@kaciras-blog/server/lib/coding-filter";
import SVGO from "svgo";

/** webpack-sources 类型定义跟不上版本，还得我自己搞 */
class MyRawAssets {

	private readonly data: Buffer | string;

	constructor(data: Buffer | string) {
		this.data = data;
	}

	source() {
		return this.data;
	}

	size() {
		return this.data.length;
	}
}

const svgOptimizer = new SVGO();

/**
 * 优化图片资源的插件，能够压缩图片资源，同时还会为一些图片额外生成WebP格式的转码，
 * WebP图片的文件名与原始的资源仅扩展名不同。
 *
 * 【使用注意】
 * 1）为了保证质量，图片始终要从原图转换，所以请勿在加载器里优化图片（如使用 image-webpack-loader）。
 * 2）该插件需要注意顺序，应当放在能生成资源文件的插件（如 CopyWebpackPlugin）后面，
 *    这样才能优化其生成的图片；但要放在像 CompressionPlugin 这种能够对压缩后结果处理的插件前面。
 *
 * 【为什么使用插件而不是加载器】
 * 加载器无法处理非JS引用的资源，例如由 CopyWebpackPlugin 复制过去的。
 */
export default class ImageOptimizePlugin implements Plugin {

	apply(compiler: Compiler) {
		compiler.hooks.emit.tapPromise(ImageOptimizePlugin.name, this.handleAssets.bind(this));
	}

	private handleAssets({ assets }: any): Promise<any> {
		const tasks: Array<Promise<any>> = [];

		for (const path of Object.keys(assets)) {
			const sep = path.lastIndexOf(".");
			const basename = path.substring(0, sep);
			const type = path.substring(sep + 1);

			if (type === "svg") {
				const text = assets[path].source().toString();
				tasks.push(svgOptimizer.optimize(text)
					.then((result) => assets[path] = new MyRawAssets(result.data)));
			}

			if (!/^(jpe?g|png|gif)$/.test(type)) {
				continue;
			}
			const rawBuffer = assets[path].source();

			const putImageAsset = async (name: string, targetType: string) => {
				assets[name] = new MyRawAssets(await codingFilter(rawBuffer, targetType));
			};

			tasks.push(putImageAsset(path, type));

			if (/^(jpe?g|png)$/.test(type)) {
				tasks.push(putImageAsset(basename + ".webp", "webp"));
			}
		}

		return Promise.all(tasks);
	}
}
