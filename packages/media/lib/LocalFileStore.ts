import { join } from "path";
import fs from "fs-extra";
import { Params } from "./WebFileService";

export default class LocalFileStore {

	private readonly directory: string;

	constructor(directory: string) {
		this.directory = directory;
	}

	async save(filename: string, buffer: Buffer) {
		const path = join(this.directory, name);
		let alreadyExists = false;

		try {
			await fs.writeFile(path, buffer, { flag: "wx" });
		} catch (e) {
			if (e.code !== "EEXIST") {
				throw e;
			}
			alreadyExists = true;
		}

		return { filename, alreadyExists };
	}

	getCache(filename: string, params: Params): Promise<ReadableStream | null> {

	}

	async putCache(filename: string, buffer: any, params: Params) {
		this.getFilePath()
	}

	/**
	 *
	 * Object.keys(tags) 对于非 ASCII 字符串的键返回的顺序不确定，必须排序。
	 *
	 * @param name
	 * @param params
	 * @private
	 */
	private getFilePath(name: string, params: Params) {
		const parts = Object.keys(params)
			.sort()
			.map(k => `${k}=${params[k]}`);
		return join(this.directory, ...parts, name);
	}
}
