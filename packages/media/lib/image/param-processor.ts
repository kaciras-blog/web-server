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
 * 翻转图片，参数为 XY 两个字母，顺序任意，也可以仅有其中一个。
 *
 * 两个字母分别表示以该轴翻转，例如：
 * - flip=X：		  翻转 X 轴（上下颠倒）。
 * - flip=Y：		  翻转 Y 轴（左右颠倒）。
 * - flip=XY（或 YX）：两个轴都翻转。
 */
export function flip(image: Sharp, argument: string) {
	switch (argument) {
		case "X":
			return image.flop();
		case "Y":
			return image.flip();
		case "XY":
		case "YX":
			return image.flop().flip();
	}
	throw new ParamsError("翻转参数错误：" + argument);
}

/**
 * 旋转图片，目前仅支持 90 度的倍数，参数格式 <deg> 单位角度。
 * 注意调用顺序，先旋转后裁剪和先裁剪后选择是不一样的。
 *
 * @see https://sharp.pixelplumbing.com/api-operation#rotate
 */
export function rotate(image: Sharp, argument: string) {
	const deg = parseInt(argument);
	if (Number.isInteger(deg)) {
		return image.rotate(deg);
	}
	throw new ParamsError("旋转参数错误：" + argument);
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
