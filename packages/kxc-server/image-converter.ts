/**
 * imagemin 内部将图片缓冲写入到临时文件，然后启动进程执行相关的图片处理程序，这种方法很低效。
 * 而sharp则直接调用相关的图片处理库更好些，但是目前sharp还不是很完善？以后考虑转过去。
 */
import sharp from "sharp";
import imagemin from "imagemin";
// import gifsicle from "imagemin-gifsicle";
// import mozjpeg from "imagemin-mozjpeg";
// import svgo from "imagemin-svgo";
// import pngquant from "imagemin-pngquant";
// import optipng from "imagemin-optipng";
import SVGO from "svgo";
import fs from "fs-extra";
import crypto from "crypto";
import path from "path";

// libvips 暂不支持动画GIF，8.8版还没正式出
// libimagequant 是 GPL 协议的，LGPL 的 libvips 默认不包含，非得自己编译不可
// const image = sharp("C:\\Users\\XuFan\\Desktop\\jaanus-jagomagi-1245520-unsplash.jpg");
// image.png({ palette: false })
// 	.toFile("C:\\Users\\XuFan\\Desktop\\test2.png")
// 	.catch((err) => console.log(err));

// const plugins = [
// 	gifsicle(),
// 	mozjpeg(),
// 	svgo(),
// 	pngquant(),
// 	optipng(),
// ];

const svgOptimizer = new SVGO();
const imageRoot = "C:\\Users\\XuFan\\Desktop";

export async function compress(buffer: Buffer, originType: string) {
	const hash = crypto
		.createHash("sha3-256")
		.update(buffer)
		.digest("hex");

	if (originType === "svg") {
		const optimized = await svgOptimizer.optimize(buffer.toString());
		return await fs.writeFile(path.join(imageRoot, `${hash}.${originType}`), optimized.data);
	}

	let image = sharp(buffer);
	if (originType !== "webp") {
		await image.webp().toFile(path.join(imageRoot, `${hash}.webp`));
	}

	switch (originType) {
		case "jpg":
		case "bmp":
			image = image.jpeg();
			originType = "jpg";
			break;
		case "png":
			image = image.png();
			break;
	}

	return image.toFile(path.join(imageRoot, `${hash}.${originType}`));

	// return imagemin.buffer(buffer, { plugins });
}
