import { Compiler, Plugin } from "webpack";
import SVGO from "svgo";
import codingFilter from "@kaciras-blog/image/lib/coding-filter";

/** webpack-sources 类型定义过时了，还得我自己搞 */
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
const SVGO_MIN_SIZE = 1024;

/**
 * 优化图片资源的插件，能够压缩图片资源，同时还会为一些图片额外生成WebP格式的转码，
 * WebP图片的文件名与原始的资源仅扩展名不同。
 *
 * 【使用注意】
 * 1）为了保证质量，图片始终要从原图转换，所以请勿在加载器里优化图片（如使用 image-webpack-loader）。
 * 2）该插件需要注意顺序，应当放在能生成资源文件的插件（如 CopyWebpackPlugin）后面，
 *    这样才能优化其生成的图片；但要放在像 CompressionPlugin 这种能够对压缩后结果再处理的插件前面。
 *
 * 【为什么使用插件而不是加载器】
 * 加载器无法处理非JS引用的资源，例如由 CopyWebpackPlugin 复制过去的。
 */
export default class ImageOptimizePlugin implements Plugin {

	apply(compiler: Compiler) {
		compiler.hooks.emit.tapPromise(ImageOptimizePlugin.name, this.handleAssets.bind(this));
	}

	// TODO: 逻辑跟 image-service 一样，怎么整合下
	private handleAssets({ assets }: any): Promise<any> {
		const tasks: Array<Promise<any>> = [];

		for (const rawName of Object.keys(assets)) {
			const sep = rawName.lastIndexOf(".");
			const basename = rawName.substring(0, sep);
			const type = rawName.substring(sep + 1);

			if (type === "svg" && assets[rawName].size() > SVGO_MIN_SIZE) {
				const text = assets[rawName].source().toString();
				tasks.push(svgOptimizer.optimize(text)
					.then((result) => assets[rawName] = new MyRawAssets(result.data)));
			}

			if (!/^(jpe?g|png|gif)$/.test(type)) {
				continue;
			}
			const rawBuffer = assets[rawName].source();

			const putOptimizedImage = async (name: string, targetType: string) => {
				assets[name] = new MyRawAssets(await codingFilter(rawBuffer, targetType));
			};

			tasks.push(putOptimizedImage(rawName, type));

			if (/^(jpe?g|png)$/.test(type)) {
				tasks.push(putOptimizedImage(basename + ".webp", "webp"));
			}
		}

		return Promise.all(tasks);
	}
}
