import { Params } from "./MediaService.js";
import ReadableStream = NodeJS.ReadableStream;

export type Data = string | Buffer;

export type FileBody = ReadableStream | Buffer | string;

export interface CacheItem {
	data: Data;
	params: Params;
}

export interface FileInfo {
	size: number;
	mtime: Date;
	data: FileBody;
}

export interface FileStore {

	/**
	 * 保存资源到源文件存储。
	 *
	 * @param name 名字
	 * @param data 数据
	 * @return 是否创建了新的文件，如果已存在则为 false
	 */
	save(name: string, data: Data): Promise<boolean>;

	/**
	 * 读取原始文件。
	 *
	 * @param name 文件名
	 * @return 如果不存在则为 null
	 */
	load(name: string): Promise<FileInfo | null>;

	/**
	 * 列出所有源文件的名字。
	 */
	list(): Promise<string[]>;

	/**
	 * 保存缓存文件，缓存文件是原文件的优化版本。
	 *
	 * 【安全性】
	 * params 参数可能用作文件名的一部分，要小心注入。
	 *
	 * @param id 缓存区的名字
	 * @param items 缓存条目列表
	 */
	putCaches(id: string, items: CacheItem[]): Promise<void>;

	/**
	 * 读取缓存文件。
	 *
	 * @param id 缓存区的名字
	 * @param params 参数
	 * @return 如果不存在则为 null
	 */
	getCache(id: string, params: Params): Promise<FileInfo | null>;

	/**
	 * 获取指定缓存区内的所有缓存的参数。
	 *
	 * @param id 缓存区的名字
	 * @return 缓存区内所有缓存的参数，如果缓存区不存在则为 null。
	 */
	listCache(id: string): Promise<Params[] | null>;
}
