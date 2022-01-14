import { join } from "path";
import fs from "fs-extra";
import { Params } from "./MediaService";
import { Data, FileStore } from "./FileStore";
import { SeparatedStoreLocation } from "../../server/lib/config";

/*
 * fs.createReadStream 当问及不存在时不抛异常，而是发出事件。
 * 所以要先调用 fs.stat 检查文件是否存在。
 *
 * https://stackoverflow.com/a/17136825
 */
async function getFileInfo(path: string) {
	try {
		const { size, mtime } = await fs.stat(path);
		const data = fs.createReadStream(path);
		return { size, mtime, data };
	} catch (e) {
		// 试试写在一行，好像可读性还可以……
		if (e.code === "ENOENT") return null; else throw e;
	}
}

/**
 * 把文件和缓存都保存在本地的磁盘上。
 */
export default class LocalFileStore implements FileStore {

	private readonly source: string;
	private readonly cache: string;

	constructor(dataDir: SeparatedStoreLocation, name: string) {
		this.source = join(dataDir.data, name);
		this.cache = join(dataDir.cache, name);

		fs.ensureDirSync(this.source);
		fs.ensureDirSync(this.cache);
	}

	async save(name: string, data: Data) {
		const path = join(this.source, name);

		try {
			await fs.writeFile(path, data, { flag: "wx" });
			return true;
		} catch (e) {
			if (e.code === "EEXIST") return false; else throw e;
		}
	}

	load(name: string) {
		return getFileInfo(join(this.source, name));
	}

	getCache(id: string, params: Params) {
		return getFileInfo(this.cachePath(id, params));
	}

	async putCache(id: string, data: Data, params: Params) {
		const path = this.cachePath(id, params);
		await fs.ensureFile(path);
		return fs.writeFile(path, data);
	}

	/**
	 * 获取缓存文件的路径，其由参数生成目录，然后再加上文件名组成。
	 *
	 * 【实现注意】
	 * 每个参数必须在目录名上包含键和值两者，因为有同值不同键的可能。
	 * Object.keys() 对于非 ASCII 字符的键返回的顺序不确定，所以需要排序。
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
