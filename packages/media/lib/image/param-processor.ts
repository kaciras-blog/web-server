import { Sharp } from "sharp";
import { ParamsError } from "../errors.js";

/**
 * 裁剪参数格式 <上>-<左>-<宽>-<高>，均为正整数。
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
 * 缩放参数格式：<宽>x<高>，其中<宽>和<高>为正整数，如果省略表示该方向上不改变。
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
