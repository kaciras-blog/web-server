const logger = require("log4js").getLogger("Http");
const send = require("koa-send");
const config = require("./config");
const sha3_256 = require("js-sha3").sha3_256;
const asyncfs = require("./asyncfs");
const path = require("path");


async function getImage (ctx) {
	const name = ctx.request.path.substring("/image/".length);
	if (!name || /[\\/]/.test(name)) {
		ctx.response.status = 404;
	} else {
		return await send(ctx, name, { root: config.image.root, maxage: 365 * 24 * 3600 * 1000 });
	}
}

async function uploadImage (ctx) {
	logger.trace("有图片正在上传");
	// if (!await apiServer.utils.checkPermission(req, "WEB", "UPLOAD_IMAGE")) {
	// 	return next(createError(403))
	// }

	const file = ctx.req.file;
	if (!file) {
		return ctx.response.status = 400;
	}

	const ext = path.extname(file.originalname).toLowerCase();
	if ([".jpg", ".png", ".gif", ".bmp", ".svg"].indexOf(ext) < 0) {
		return ctx.response.status = 400;
	}

	const name = sha3_256(file.buffer).toUpperCase() + ext;
	const store = path.join(config.image.root, name);

	if (await asyncfs.existsAsync(store)) {
		ctx.response.status = 200;
		ctx.response.set("Location", "/image/" + name);
	} else {
		logger.debug("保存上传的图片:", name);
		await asyncfs.writeFileAsync(store, file.buffer);
		ctx.response.status = 201;
		ctx.response.set("Location", "/image/" + name);
	}
}

module.exports = async (ctx, next) => {
	if (!ctx.request.path.startsWith("/image")) {
		await next();
	} else if (ctx.request.method === "GET") {
		await getImage(ctx);
	} else if (ctx.request.method === "POST") {
		await uploadImage(ctx, next);
	} else {
		ctx.response.status = 405;
	}
};
