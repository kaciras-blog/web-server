import { minifyPreset } from "../webpack/reactive-svg-loader";
import { extname, parse } from "path";
import { encodeWebp, optimize } from "@kaciras-blog/media/lib/image/encoder";
import * as svgo from "svgo";
import { OutputAsset, OutputBundle } from "rollup";
import { Plugin } from "vite";

const svgoConfig = {
	plugins: [minifyPreset],
};

type AssetMap = Record<string, OutputAsset>;

interface Optimizer {

	test: RegExp;

	optimize(assets: AssetMap, name: string): Promise<void>;
}

const optimizers: Optimizer[] = [
	{
		test: /\.(jpe?g|png|gif)$/,
		async optimize(assets: AssetMap, name: string) {
			const buffer = assets[name].source as Buffer;
			const type = extname(name).slice(1);
			assets[name].source = await optimize(buffer, type);
		},
	},
	{
		test: /\.(jpe?g|png)$/,
		async optimize(assets: AssetMap, name: string) {
			const origin = assets[name];
			const buffer = origin.source as Buffer;

			name = parse(name).name + ".webp";
			assets[name] = {
				...origin,
				fileName: name,
				source: await encodeWebp(buffer),
			};
		},
	},
	{
		// 只用 SVGO 优化，压缩由其他的插件实现
		test: /\.svg$/,
		async optimize(assets: AssetMap, name: string) {
			const text = assets[name].source.toString();

			const result = svgo.optimize(text, svgoConfig);
			if (result.error !== undefined) {
				throw result.modernError;
			}
			assets[name].source = result.data;
		},
	},
];

/**
 * 优化图片资源的插件，能够压缩图片资源，同时还会为一些图片额外生成WebP格式的转码，
 * WebP图片的文件名与原始的资源仅扩展名不同。
 *
 * 【使用注意】
 * 1）为了保证质量，图片始终要从原图转换，所以请勿在加载器里优化图片。
 * 2）注意顺序，该插件应当放在能生成资源文件的插件（如 CopyWebpackPlugin）后面，
 *    这样才能优化其生成的图片；但要放在像 CompressionPlugin 这种能够继续优化的插件前面。
 */
export default function optimizeImage(include?: RegExp): Plugin {
	return {
		name: "kaciras:optimize-image",
		async generateBundle(_: unknown, bundle: OutputBundle) {
			const tasks: Array<Promise<void>> = [];
			const filtered = bundle as AssetMap;

			for (const name of Object.keys(bundle)) {
				if (bundle[name].type !== "asset") {
					continue;
				}
				if (include && !include.test(name)) {
					continue;
				}
				optimizers
					.filter(v => v.test.test(name))
					.map(v => v.optimize(filtered, name))
					.forEach(t => tasks.push(t));
			}

			return Promise.all(tasks).then<void>();
		},
	};
}
