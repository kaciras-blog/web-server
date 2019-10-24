import sharp, { Metadata, ResizeOptions } from "sharp";
import { InvalidImageError } from "./filter-runner";

export interface Presets {
	[key: string]: (metadata: Metadata) => ResizeOptions;
}

/**
 * 创建缩放图片的处理器，其通过预设来缩放图片。
 *
 * @param presets 预设集合
 */
export function PresetResizeFilter(presets: Presets) {

	return async (buffer: Buffer, presetName: string) => {
		const preset = presets[presetName];
		if (!preset) {
			throw new InvalidImageError(`不存在的预设名：${presetName}`);
		}
		const image = sharp(buffer);
		const metadata = await image.metadata();
		return image.resize(null, null, preset(metadata)).toBuffer();
	};
}

/**
 * 缩放参数格式：<宽>x<高>，其中<宽>和<高>为正整数，如果省略表示该方向上不改变。
 *
 * @param buffer 图片数据
 * @param arg 缩放参数
 */
export async function resizeByArgument(buffer: Buffer, arg: string) {
	const match = /^(\d*)x(\d*)$/.exec(arg);
	if (!match) {
		throw new InvalidImageError("缩放参数的格式错误");
	}
	const [, width, height] = match;
	const w = width ? parseInt(width) : null;
	const h = height ? parseInt(height) : null;
	return sharp(buffer).resize(w, h).toBuffer();
}
