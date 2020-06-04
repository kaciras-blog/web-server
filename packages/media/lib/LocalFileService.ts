import path from "path";
import mime from "mime-types";
import fs from "fs-extra";
import { WebFileService } from "./WebFileService";
import { hashName } from "./common";


export default class LocalFileService implements WebFileService {

	private readonly directory: string;

	constructor(directory: string) {
		this.directory = directory;
	}

	getAllNames() {
		return fs.readdir(this.directory);
	}

	async save(file: WebFile) {
		const { buffer, mimetype } = file;

		const name = hashName(buffer) + "." + mime.extension(mimetype);
		const fullname = path.join(this.directory, name);

		try {
			await fs.writeFile(fullname, buffer, { flag: "wx" });
		} catch (e) {
			if (e.code !== "EEXIST") throw e;
		}

		return { name }
	}

	async load(name: string): Promise<FileReader | null> {
		const fullname = path.join(this.directory, name);

		try {
			const stats = await fs.stat(fullname);
			return (range) => fs.createReadStream(fullname, range);
		} catch (e) {
			if (e.code !== "ENOENT") throw e;
		}

		return null;
	}
}