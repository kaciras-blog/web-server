import { join } from "path";
import fs from "fs-extra";
import { hashName } from "./common";
import { Params } from "./WebFileService";
import { FileStore } from "./FileStore";

/**
 * 把文件和缓存都保存在本地的磁盘上。
 */
export default class LocalFileStore implements FileStore {

	private readonly directory: string;

	constructor(directory: string) {
		this.directory = directory;
		fs.ensureDirSync(directory);
	}

	async save(data: Buffer, type: string, rawName: string) {
		const name = `${hashName(data)}.${type}`;
		const path = join(this.directory, name);

		let createNew = true;
		try {
			await fs.writeFile(path, data, { flag: "wx" });
		} catch (e) {
			if (e.code !== "EEXIST") {
				throw e;
			}
			createNew = false;
		}

		return { name, createNew };
	}

	async load(name: string) {
		fs.createReadStream(join(this.directory, name))
	}

	getCache(name: string, params: Params) {
		const path = this.getFilePath(name, params);
		try {
			return Promise.resolve(fs.createReadStream(path));
		} catch (e) {
			if (e.code !== "ENOENT") {
				return Promise.reject(e);
			}
			return Promise.resolve(null);
		}
	}

	async putCache(data: Buffer, name: string, params: Params) {
		const path = this.getFilePath(name, params);
		await fs.ensureFile(path);
		return fs.writeFile(path, data);
	}

	/**
	 * 获取缓存文件的路径，其由参数生成目录，然后再加上文件名组成。
	 *
	 * 【实现注意】
	 * 每个参数必须在目录名上包含键和值两者，不能只有值，因为有同值不同键的可能。
	 * Object.keys(tags) 对于非 ASCII 字符的键返回的顺序不确定，所以需要排序。
	 *
	 * @param name 文件名
	 * @param params 参数
	 * @private
	 */
	private getFilePath(name: string, params: Params) {
		const parts = Object.keys(params)
			.sort()
			.map(k => `${k}=${params[k]}`);
		return join(this.directory, ...parts, name);
	}
}
