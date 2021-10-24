import { LoaderContext } from "webpack";
import { Metadata, Region } from "sharp";
import createCropFilter from "@kaciras-blog/image/lib/crop-filter";

export const raw = true;

function IndexBannerMobile(metadata: Metadata): Region {
	const WIDTH = 560;
	return {
		top: 0,
		left: Math.round((metadata.width! - WIDTH) / 2),
		width: WIDTH,
		height: metadata.height!,
	};
}

const process = createCropFilter({
	IndexBannerMobile,
});

/**
 * 裁剪和缩放图片的加载器，通过 url 中的参数来裁剪和缩放图片。
 * 仅支持位图，矢量图 SVG 没法简单地裁剪且无需缩放。
 *
 * @param content 图片数据
 */
export default function (this: LoaderContext<never>, content: Buffer) {
	if (!this.resourceQuery) {
		return content;
	}
	const callback = this.async();
	const query = new URLSearchParams(this.resourceQuery.slice(1));

	process(content, query.get("size")).then(v => callback(null, v));
}
