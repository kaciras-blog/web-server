const logger = require("log4js").getLogger("Http");
const send = require("koa-send");
const sha3_256 = require("js-sha3").sha3_256;
const asyncfs = require("fs").promises;
const path = require("path");
const { fileExist } = require("./utils");
const config = require("../config");


// const redis = require("redis");
//
// const client = redis.createClient();
//
// client.on("error", function (err) {
// 	console.log("Error " + err);
// });

async function getImage (ctx) {
	const name = ctx.path.substring("/image/".length);
	if (!name || /[\\/]/.test(name)) {
		ctx.status = 404;
	} else {
		return await send(ctx, name, { root: config.imageRoot, maxage: config.cacheMaxAge });
	}
}

async function uploadImage (ctx) {
	logger.trace("有图片正在上传");

	// if (!await apiServer.utils.checkPermission(req, "WEB", "UPLOAD_IMAGE")) {
	// 	return next(createError(403))
	// }

	const file = ctx.req.file;
	if (!file) {
		return ctx.status = 400;
	}

	let ext = path.extname(file.originalname).toLowerCase();
	if (ext === ".jpeg") {
		ext = ".jpg"; // 统一使用JPG
	}
	if ([".jpg", ".png", ".gif", ".bmp", ".svg"].indexOf(ext) < 0) {
		return ctx.status = 400;
	}

	const name = sha3_256(file.buffer) + ext;
	const store = path.join(config.imageRoot, name);

	if (await fileExist(store)) {
		ctx.status = 200;
	} else {
		logger.debug("保存上传的图片:", name);
		await asyncfs.writeFile(store, file.buffer);
		ctx.status = 201;
	}

	// 保存的文件名通过 Location 响应头来传递
	ctx.set("Location", "/image/" + name);
}

module.exports = function () {
	return async (ctx, next) => {
		if (!ctx.path.startsWith("/image")) {
			await next();
		} else if (ctx.method === "GET") {
			await getImage(ctx);
		} else if (ctx.method === "POST") {
			await uploadImage(ctx, next);
		} else {
			ctx.status = 405;
		}
	};
};
