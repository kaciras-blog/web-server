import sharp, { Metadata, Region } from "sharp";
import { BadImageError, FilterArgumentError } from "./errors";

/**
 * 预设集合，所有的裁剪方式都事先在这里配置，然后才能使用。
 */
export interface Presets {
	[key: string]: (metadata: Metadata) => Region;
}

/**
 * 创建裁剪图片的处理器，通过预设来裁剪图片指定的区域。
 *
 * 这个处理器通常放在靠前的位置，裁剪后的图片可以看做是一张新图。
 *
 * @param presets 预设集合
 */
export default function createPresetCropFilter(presets: Presets) {

	// 返回的图片格式跟原图一样
	return async (buffer: Buffer, name: string) => {
		const preset = presets[name];
		if (!preset) {
			throw new FilterArgumentError(`不存在的预设名：${name}`);
		}
		const image = sharp(buffer);
		const metadata = await image.metadata()
			.catch(() => {
				throw new BadImageError();
			});
		return image.extract(preset(metadata)).toBuffer();
	};
}
