import { join } from "path";
import mime from "mime-types";
import fs from "fs-extra";
import { WebFileService } from "./WebFileService";
import { hashName } from "./common";
import { Context } from "koa";


export default class LocalFileService implements WebFileService {

	private readonly directory: string;

	constructor(directory: string) {
		this.directory = directory;
	}

	getAllNames() {
		return fs.readdir(this.directory);
	}

	async save(ctx: Context) {
		const { buffer, mimetype } = ctx.file;

		const name = hashName(buffer) + "." + mime.extension(mimetype);
		const path = join(this.directory, name);

		try {
			await fs.writeFile(path, buffer, { flag: "wx" });
		} catch (e) {
			if (e.code !== "EEXIST") throw e;
		}

		ctx.body = { name };
	}

	async load(name: string) {
		const path = join(this.directory, name);

		try {
			const stats = await fs.stat(path);
			return (range) => fs.createReadStream(path, range);
		} catch (e) {
			if (e.code !== "ENOENT") throw e;
		}
	}
}
