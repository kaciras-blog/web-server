import sharp, { Sharp } from "sharp";
import { ParamsError } from "./errors";

export function crop(image: Sharp, argument: string) {
	const match = /^(\d+)-(\d+)-(\d+)-(\d+)$/.exec(argument);
	if (!match) {
		throw new ParamsError("裁剪参数错误：" + argument);
	}
	const [, left, top, width, height] = match;

	return image.extract({
		left: parseInt(left),
		top: parseInt(top),
		width: parseInt(width),
		height: parseInt(height),
	});
}

/**
 * 缩放参数格式：<宽>x<高>，其中<宽>和<高>为正整数，如果省略表示该方向上不改变。
 *
 * @param image 图片
 * @param argument 缩放参数
 */
export function resize(image: Sharp, argument: string) {
	const match = /^(\d*)x(\d*)$/.exec(argument);
	if (!match) {
		throw new ParamsError("缩放参数错误：" + argument);
	}
	const [, width, height] = match;

	const w = width ? parseInt(width) : null;
	const h = height ? parseInt(height) : null;
	return image.resize(w, h);
}

export default function (buffer: Buffer, params: Params) {
	let image = sharp(buffer);

	if (params.crop) {
		image = crop(image, params.crop);
	}
	if (params.resize) {
		image = resize(image, params.resize);
	}

	return image;
}
