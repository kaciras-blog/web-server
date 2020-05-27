import { Params } from "./WebFileService";
import sharp, { Sharp } from "sharp";
import { FilterArgumentError } from "./errors";

export function crop(image: Sharp, argument: string) {

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
		throw new FilterArgumentError("缩放参数的格式错误");
	}
	const [, width, height] = match;
	const w = width ? parseInt(width) : null;
	const h = height ? parseInt(height) : null;
	return image.resize(w, h);
}

export default function (buffer: Buffer, params: Params) {
	let image = sharp(buffer);



	if (params.resize) {
		image = resize(image, params.resize);
	}


}
