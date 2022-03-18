import { extname } from "path";
import { OutputAsset, PluginContext } from "rollup";
import { Plugin } from "vite";
import { MediaAttrs, Optimizer, RasterOptimizer, SVGOptimizer } from "@kaciras-blog/media";

const sss = new SVGOptimizer();
const rs = new RasterOptimizer();

function interpolateName(raw: string, attrs: MediaAttrs) {
	const { type, encoding } = attrs;
	const ext = extname(raw);

	let suffix = ext;
	if (type) {
		suffix = "." + type;
	}

	if (encoding === "gzip") {
		suffix += ".gz";
	} else if (encoding) {
		suffix += "." + encoding;
	}

	return raw.slice(0, -ext.length) + suffix;
}

async function optimize(this: PluginContext, asset: OutputAsset) {
	const name = asset.fileName;
	const type = extname(name).slice(1);

	let optimizer: Optimizer;

	// TODO: 跟 media 服务复用代码
	switch (type) {
		case "svg":
			optimizer = sss;
			break;
		case "jpg":
		case "png":
		case "gif":
			optimizer = rs;
			break;
		default:
			return;
	}

	let buffer = asset.source as string | Buffer;
	if (typeof buffer === "string") {
		buffer = Buffer.from(buffer);
	}

	const items = await optimizer.buildCache({
		buffer,
		type,
		parameters: {},
	});

	for (const cache of items) {
		const { data, params } = cache;
		const fileName = interpolateName(name, params);

		if (fileName === name) {
			asset.source = data;
		} else {
			this.emitFile({ type: "asset", source: data, fileName });
		}
	}
}

/**
 * 优化图片资源的插件，能够压缩图片资源，同时还会为一些图片额外生成 WebP 格式的转码，
 * WebP 图片的文件名与原始的资源仅扩展名不同。
 *
 * 【使用注意】
 * 1）为了保证质量，图片始终要从原图转换，所以请勿在加载器里优化图片。
 * 2）注意顺序，该插件应当放在能生成资源文件的插件（如 CopyWebpackPlugin）后面，
 *    这样才能优化其生成的图片；但要放在像 CompressionPlugin 这种能够继续优化的插件前面。
 */
export default function optimizeImage(include?: RegExp): Plugin {
	return {
		name: "kaciras:optimize-image",

		// 本插件所修改的图片，以及生成的额外文件应该不会被其他插件再用了。
		enforce: "post",

		// 仅在客户端的生产环境构建时才启用。
		apply(config, env) {
			return !config.build?.ssr && env.mode === "production";
		},

		async generateBundle(_, bundle) {
			for (const name of Object.keys(bundle)) {
				const asset = bundle[name];
				if (asset.type !== "asset") {
					continue;
				}
				if (include && !include.test(name)) {
					continue;
				}
				await optimize.call(this, asset);
			}
		},
	};
}
