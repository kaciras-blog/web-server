import crypto from "crypto";
import path from "path";
import { Context, ExtendableContext } from "koa";
import fs from "fs-extra";
import mime from "mime-types";
import sendFileRange from "./send-range";

interface VideoDownloadContext extends ExtendableContext{
	params: { name: string }
}

export async function downloadVideo(directory: string, ctx: VideoDownloadContext) {
	const name = path.basename(ctx.params.name);
	const fullname = path.join(directory, name);
	const stats = await fs.stat(fullname);
	return sendFileRange(ctx, fullname, stats.size);
}

export async function uploadVideo(directory: string,ctx: Context) {
	const { buffer, mimetype } = ctx.file;
	const hash = crypto
		.createHash("sha3-256")
		.update(buffer)
		.digest("hex");

	const name = hash + "." + mime.extension(mimetype);
	await fs.writeFile(path.join(directory, name), buffer);

	ctx.status = 201;
	ctx.set("Location", `${ctx.path}/${name}`);
}
