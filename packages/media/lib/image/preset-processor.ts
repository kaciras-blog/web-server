import sharp, { Metadata, Region, Sharp, Stats } from "sharp";
import { BadDataError, ParamsError } from "../errors";

/**
 * 预设集合，所有的裁剪方式都事先在这里配置，然后才能使用。
 */
export interface Presets {
	[key: string]: (metadata: Metadata, stats: Stats) => Region;
}

async function getPresetArgs(image: Sharp) {
	const stats = await image.stats().catch(BadDataError.convert);
	const metadata = await image.metadata().catch(BadDataError.convert);
	return [metadata, stats] as [Metadata, Stats];
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
		const presetFn = presets[name];
		if (!presetFn) {
			throw new ParamsError(`不存在的预设名：${name}`);
		}

		const image = sharp(buffer);
		const args = await getPresetArgs(image);

		return image.extract(presetFn(...args)).toBuffer();
	};
}