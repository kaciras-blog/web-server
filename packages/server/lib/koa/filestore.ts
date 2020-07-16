import crypto from "crypto";
import { basename, extname, join } from "path";
import { Context, ExtendableContext } from "koa";
import fs from "fs-extra";
import sendFileRange from "./send-range";

interface FileDownloadContext extends ExtendableContext {
	params: { name: string };
}

export async function downloadFile(directory: string, ctx: FileDownloadContext) {
	const name = basename(ctx.params.name);
	const fullname = join(directory, name);

	try {
		const stats = await fs.stat(fullname);
		ctx.set("Last-Modified", stats.mtime.toUTCString());
		ctx.set("Cache-Control", "public,max-age=31536000");
		ctx.type = extname(name);

		return sendFileRange(ctx, fullname, stats.size);
	} catch (e) {
		if (e.code !== "ENOENT") throw e;
	}
}

export async function uploadFile(directory: string, ctx: Context) {
	const { buffer, originalname } = ctx.file;

	const hash = crypto
		.createHash("sha3-256")
		.update(buffer)
		.digest("hex");

	const name = hash + extname(originalname);
	try {
		await fs.writeFile(join(directory, name), buffer, { flag: "wx" });
	} catch (e) {
		if (e.code !== "EEXIST") throw e;
	}

	ctx.status = 201;
	ctx.set("Location", `${ctx.path}/${name}`);
}
