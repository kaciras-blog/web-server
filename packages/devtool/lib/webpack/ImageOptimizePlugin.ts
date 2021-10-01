import { Compiler, sources } from "webpack";
import { extname, parse } from "path";
import * as svgo from "svgo";
import { encodeWebp, optimize } from "@kaciras-blog/media/lib/image/encoder";
import { minifyPreset } from "./reactive-svg-loader";

// TODO: webpack 为什么不导出这些类型？
type CompilationAssets = Record<string, sources.Source>;

const { RawSource } = sources;

const svgoConfig = {
	plugins: [minifyPreset],
};

interface Optimizer {

	test: RegExp;

	optimize(assets: CompilationAssets, name: string): Promise<void>;
}

const optimizers: Optimizer[] = [
	{
		test: /\.(jpe?g|png|gif)$/,
		async optimize(assets: CompilationAssets, name: string) {
			const buffer = assets[name].buffer();
			const type = extname(name).slice(1);
			assets[name] = new RawSource(await optimize(buffer, type));
		},
	},
	{
		test: /\.(jpe?g|png)$/,
		async optimize(assets: CompilationAssets, name: string) {
			const buffer = assets[name].buffer();
			name = parse(name).name + ".webp";
			assets[name] = new RawSource(await encodeWebp(buffer));
		},
	},
	{
		// 只用 SVGO 优化，压缩由其他的插件实现
		test: /\.svg$/,
		async optimize(assets: CompilationAssets, name: string) {
			const text = assets[name].source().toString();
			assets[name] = new RawSource(svgo.optimize(text, svgoConfig).data);
		},
	},
];

/**
 * 优化图片资源的插件，能够压缩图片资源，同时还会为一些图片额外生成WebP格式的转码，
 * WebP图片的文件名与原始的资源仅扩展名不同。
 *
 * 【使用注意】
 * 1）为了保证质量，图片始终要从原图转换，所以请勿在加载器里优化图片（如使用 image-webpack-loader）。
 * 2）注意顺序，该插件应当放在能生成资源文件的插件（如 CopyWebpackPlugin）后面，
 *    这样才能优化其生成的图片；但要放在像 CompressionPlugin 这种能够继续优化的插件前面。
 *
 * 【为什么使用插件而不是加载器】
 * 加载器无法处理非 JS 引用的资源，例如由 copy-webpack-plugin 复制过去的。
 */
export default class ImageOptimizePlugin {

	private readonly include?: RegExp;

	constructor(include?: RegExp) {
		this.include = include;
		this.handleAssets = this.handleAssets.bind(this);
	}

	apply(compiler: Compiler) {
		compiler.hooks.compilation.tap(ImageOptimizePlugin.name, compilation => {
			compilation.hooks.processAssets.tapPromise(ImageOptimizePlugin.name, this.handleAssets);
		});
	}

	private handleAssets(assets: CompilationAssets) {
		const tasks: Array<Promise<void>> = [];

		let names = Object.keys(assets);
		if (this.include) {
			names = names.filter(n => this.include!.test(n));
		}

		for (const name of names) {
			optimizers
				.filter(v => v.test.test(name))
				.map(v => v.optimize(assets, name))
				.forEach(v => tasks.push(v));
		}

		return Promise.all(tasks).then<void>();
	}
}
