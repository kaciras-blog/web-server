import sharp, { Metadata, Region, ResizeOptions } from "sharp";
import { InvalidImageError } from "./filter-runner";

/**
 * 定义一个配置，指定了这类图片要怎样裁剪和缩放。
 * 在URL里写这些参数实在把我恶心到了，常用的分隔符全TM是保留字符。
 */
export interface CropConfig {
	region?: Region;
	resize?: ResizeOptions;
}

/**
 * 预设集合，所有的裁剪方式都事先在这里配置，然后才能使用。
 */
export interface Presets {
	[key: string]: (metadata: Metadata) => CropConfig;
}

/**
 * 创建裁剪图片的处理器，其通过预设来裁剪图片指定的区域。
 *
 * 通常这个处理器要放在靠前的位置，裁剪后的图片可以看做是一张新图。
 *
 * @param presets 预设集合
 */
export default function CreateCropFilter(presets: Presets) {

	return async (buffer: Buffer, presetName: string) => {
		const preset = presets[presetName];
		if (!preset) {
			throw new InvalidImageError(`不存在的预设名：${presetName}`);
		}
		let image = sharp(buffer);
		const metadata = await image.metadata();

		const { resize, region } = preset(metadata);
		if (region) {
			image = image.extract(region);
		}
		if (resize) {
			image = image.resize(null, null, resize);
		}
		return await image.toBuffer();
	};
}
