import { URLSearchParams } from "url";
import { join } from "path";
import fs from "fs-extra";
import { Params } from "./MediaService.js";
import { CacheItem, Data, FileStore } from "./FileStore.js";

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

function serialize(params: Params) {
	const filename = Object.keys(params)
		.sort()
		.map(k => `${k}=${params[k]}`)
		.join("&");
	return filename || "default";
}

function deserialize(filename: string) {
	if (filename === "default") {
		return {};
	}
	const params = new URLSearchParams(filename);
	return Object.fromEntries(params);
}

/**
 * 把文件和缓存都保存在本地的磁盘上。
 */
export default class LocalFileStore implements FileStore {

	private readonly source: string;
	private readonly cache: string;

	/**
	 * 创建实例，指定目录，如果不存在则会创建。
	 *
	 * @param source 原文件目录
	 * @param cache 缓存目录
	 */
	constructor(source: string, cache: string) {
		this.source = source;
		this.cache = cache;

		fs.ensureDirSync(source);
		fs.ensureDirSync(cache);
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

	async putCaches(id: string, items: CacheItem[]) {
		const folder = join(this.cache, id);
		await fs.mkdir(folder, { recursive: true });

		for (const { data, params } of items) {
			await fs.writeFile(this.cachePath(id, params), data);
		}
	}

	async listCache(id: string) {
		try {
			const names = await fs.readdir(join(this.cache, id));
			return names.map(deserialize);
		} catch (e) {
			if (e.code === "ENOENT") return null; else throw e;
		}
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
		return join(this.cache, id, serialize(params));
	}
}
