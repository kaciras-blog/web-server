import { extname, parse } from "path";
import * as svgo from "svgo";
import { OutputAsset, OutputBundle } from "rollup";
import { Plugin } from "vite";
import { encodeWebp, optimizeRaster } from "@kaciras-blog/media";
import { minifyPreset } from "./vue-svg-component.js";

const svgoConfig = {
	plugins: [minifyPreset],
};

type AssetMap = Record<string, OutputAsset>;

interface Optimizer {

	test: RegExp;

	apply(assets: AssetMap, name: string): Promise<void>;
}

const optimizers: Optimizer[] = [
	{
		test: /\.(jpe?g|png|gif)$/,
		async apply(assets: AssetMap, name: string) {
			const buffer = assets[name].source as Buffer;
			const type = extname(name).slice(1);
			assets[name].source = await optimizeRaster(buffer, type);
		},
	},
	{
		test: /\.(jpe?g|png)$/,
		async apply(assets: AssetMap, name: string) {
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
		async apply(assets: AssetMap, name: string) {
			const text = assets[name].source.toString();

			const result = svgo.optimize(text, svgoConfig);
			if (result.error !== undefined) {
				throw result.modernError;
			}
			assets[name].source = result.data;
		},
	},
];

function run(opt: Optimizer, map: AssetMap, name: string) {
	try {
		return opt.apply(map, name);
	} catch (cause) {
		// @ts-ignore 类型没跟上
		throw new Error(`Optimize failed for ${name}`, { cause });
	}
}

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

		// 仅在客户端的生产环境构建时才启用
		apply(config, env) {
			return !config.build?.ssr && env.command === "build";
		},

		async generateBundle(_: unknown, bundle: OutputBundle) {
			const tasks: Array<Promise<void>> = [];

			// 部分元素在循环中排除了，这里直接强制转换。
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
					.map(v => run(v, filtered, name))
					.forEach(t => tasks.push(t));
			}

			return Promise.all(tasks).then<void>();
		},
	};
}
