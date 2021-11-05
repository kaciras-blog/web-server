import { LoaderContext } from "webpack";
import createCropFilter from "@kaciras-blog/media/lib/image/preset-processor";

export const raw = true;

const process = createCropFilter({

	// 首页的大背景，M 代表手机屏幕
	IndexBannerM({ width, height }) {
		const targetWidth = 560;
		const left = (width! - targetWidth) / 2;
		return {
			width: targetWidth,
			height: height!,
			top: 0,
			left: Math.round(left),
		};
	},
});

/**
 * 裁剪和缩放图片的加载器，通过 url 中的参数来裁剪和缩放图片。
 * 仅支持位图，SVG 没法简单地裁剪且无需缩放。
 *
 * @param content 图片数据
 */
export default function (this: LoaderContext<never>, content: Buffer) {
	const query = new URLSearchParams(this.resourceQuery.slice(1));
	const preset = query.get("size");
	if (!preset) {
		return content;
	}
	const callback = this.async();
	process(content, preset).then(result => callback(null, result));
}
