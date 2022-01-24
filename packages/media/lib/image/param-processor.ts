import { Sharp } from "sharp";
import { ParamsError } from "../errors.js";

/**
 * 根据指定的参数裁剪图片，参数格式 <上>-<左>-<宽>-<高>，单位像素。
 *
 * @param image 图片
 * @param argument 参数
 */
export function crop(image: Sharp, argument: string) {
	const match = /^(\d+)-(\d+)-(\d+)-(\d+)$/.exec(argument);
	if (!match) {
		throw new ParamsError("裁剪参数错误：" + argument);
	}
	const [, top, left, width, height] = match;

	return image.extract({
		top: parseInt(top),
		left: parseInt(left),
		width: parseInt(width),
		height: parseInt(height),
	});
}

/**
 * 根据参数缩放图片，参数格式：<宽>x<高>，单位像素，表示把指定的方向缩放到该大小。
 * 宽和高都可以省略，表示该方向上不改变。
 *
 * 比如 "x50" 表示宽不变，高度缩放到 50 像素。
 *
 * @param image 图片
 * @param argument 参数
 */
export function resize(image: Sharp, argument: string) {
	const match = /^(\d*)x(\d*)$/.exec(argument);
	if (!match) {
		throw new ParamsError("缩放参数错误：" + argument);
	}
	const [, w, h] = match;

	const width = w ? parseInt(w) : null;
	const height = h ? parseInt(h) : null;
	return image.resize(width, height);
}
