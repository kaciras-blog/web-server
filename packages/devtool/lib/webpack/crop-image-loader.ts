import { LoaderContext } from "webpack";
import { Metadata, Region } from "sharp";
import * as loaderUtils from "loader-utils";
import CreateCropFilter from "@kaciras-blog/image/lib/crop-filter";

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

const processor = CreateCropFilter({
	IndexBannerMobile,
});

/**
 * 裁剪和缩放图片的加载器，通过 url 中的参数来裁剪和缩放图片。
 * 该加载器仅支持位图，SVG 等矢量图没法简单地裁剪，且无需缩放。
 *
 * @param content 图片数据
 */
export default async function CropImageLoader(this: LoaderContext<never>, content: Buffer) {
	if (!this.resourceQuery) {
		return content;
	}
	const loaderCallback = this.async();
	const query = loaderUtils.parseQuery(this.resourceQuery);

	if (typeof query.size !== "string") {
		throw new Error("Invalid size parameter: " + query.size);
	}
	loaderCallback(null, await processor(content, query.size));
}
