import { Params } from "./WebFileService";
import sharp from "sharp";

export default function process(buffer: Buffer, params: Params) {
	let s = sharp(buffer);
	const resize = /^(\d*)x(\d*)$/.exec(params.resize);
	if (resize) {

	}
}