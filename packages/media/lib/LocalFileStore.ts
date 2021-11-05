import { join } from "path";
import fs from "fs-extra";
import { checkCaseSensitive } from "./fs-utils";
import { Params } from "./WebFileService";
import { Data, FileStore } from "./FileStore";
import { DataDirectory } from "../../server/lib/options";

async function getFileInfo(path: string) {
	try {
		const data = fs.createReadStream(path);
		const { size, mtime } = await fs.stat(path);
		return { size, mtime, data };
	} catch (e) {
		if (e.code !== "ENOENT") {
			throw e;
		}
		return null;
	}
}

/**
 * 把文件和缓存都保存在本地的磁盘上。
 */
export default class LocalFileStore implements FileStore {

	private readonly source: string;
	private readonly cache: string;

	constructor(dataDir: DataDirectory, name: string) {
		if(typeof dataDir === "string") {
			this.source = join(dataDir, "data", name);
			this.cache = join(dataDir, "cache", name);
		} else {
			this.source = join(dataDir.data, name);
			this.cache = join(dataDir.cache, name);
		}

		fs.ensureDirSync(this.source);
		fs.ensureDirSync(this.cache);

		checkCaseSensitive(this.source);
		checkCaseSensitive(this.cache);
	}

	async save(data: Data, name: string) {
		const path = join(this.source, name);

		try {
			await fs.writeFile(path, data, { flag: "wx" });
			return true;
		} catch (e) {
			if (e.code !== "EEXIST") {
				throw e;
			}
			return false;
		}
	}

	load(name: string) {
		return getFileInfo(join(this.source, name));
	}

	getCache(id: string, params: Params) {
		return getFileInfo(this.cachePath(id, params));
	}

	async putCache(data: Data, id: string, params: Params) {
		const path = this.cachePath(id, params);
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
	 * 【文件名长度】
	 * Windows 和 Linux 大部分文件系统的文件名最长不过 256 个字符，
	 * https://docs.microsoft.com/en-us/windows/win32/fileio/maximum-file-path-limitation
	 *
	 * @param id 资源的 ID，一般为 HASH
	 * @param params 参数
	 */
	private cachePath(id: string, params: Params) {
		let filename = Object.keys(params)
			.sort()
			.map(k => `${k}=${params[k]}`)
			.join("_");
		filename ||= "default";
		return join(this.cache, id, filename);
	}
}
