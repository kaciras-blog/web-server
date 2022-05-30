import { readFileSync } from "fs";
import { basename } from "path";
import { URLSearchParams } from "url";
import MagicString from "magic-string";
import { Plugin, ResolvedConfig } from "vite";
import { createPresetCropper } from "@kaciras-blog/media";

const imageRE = /\.(jpe?g|png|webp)$/;
const assetUrlRE = /__IMAGE_ASSET_([a-z\d]{8})__(?:_(.*?)__)?/g;

const cropPresets = createPresetCropper({

	// 首页的大背景，M 代表手机屏幕
	IndexBannerM({ width, height }) {
		const tw = 560;
		const left = Math.round((width! - tw) / 2);
		return `0-${left}-${tw}-${height}`;
	},
});

/**
 * 裁剪和缩放图片的加载器，通过 url 中的参数来裁剪和缩放图片。
 * 仅支持位图，因为 SVG 没法简单地裁剪且无需缩放。
 *
 * TODO: Vite 的开发模式不支持 emitFile，这个功能可能无法实现。
 */
export default function processImage(): Plugin {
	let viteConfig: ResolvedConfig;

	return {
		name: "kaciras:process-image",
		enforce: "pre",

		configResolved(config) {
			viteConfig = config;
		},

		async load(id) {
			const [file, query] = id.split("?", 2);
			const params = new URLSearchParams(query);
			const preset = params.get("size");

			if (!imageRE.test(file) || !preset) {
				return null;
			}
			const buffer = await cropPresets(readFileSync(file), preset);
			const name = basename(file);

			const fileHandle = this.emitFile({
				type: "asset",
				name,
				source: buffer,
			});

			return `export default '__IMAGE_ASSET_${fileHandle}__'`;
		},

		renderChunk(code) {
			const s = new MagicString(code);

			s.replace(assetUrlRE, (_, hash, postfix = "") => {
				const name = this.getFileName(hash);
				return viteConfig.base + name + postfix;
			});

			if (!s.hasChanged()) {
				return null;
			}

			const { sourcemap } = viteConfig.build;
			return {
				code: s.toString(),
				map: sourcemap ? s.generateMap({ hires: true }) : null,
			};
		},
	};
}
