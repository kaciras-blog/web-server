import sharp, { Metadata, Sharp, Stats } from "sharp";
import { BadDataError, ParamsError } from "../errors.js";
import { crop } from "./param-processor.js";

/**
 * 预设集合，所有的裁剪方式都事先在这里配置，然后才能使用。
 */
export interface Presets {
	[key: string]: (metadata: Metadata, stats: Stats) => string;
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
export default function createPresetCropper(presets: Presets) {

	// 返回的图片格式跟原图一样
	return async (buffer: Buffer, name: string) => {
		const presetFn = presets[name];
		if (!presetFn) {
			throw new ParamsError(`不存在的预设名：${name}`);
		}

		/*
		 * 某些图片可能不规范，这里设置 failOnError: false 容忍这种情况。
		 * https://github.com/lovell/sharp/issues/3050
		 */
		const image = sharp(buffer, { failOnError: false });
		const args = await getPresetArgs(image);

		return crop(image, presetFn(...args)).toBuffer();
	};
}
