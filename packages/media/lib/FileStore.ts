import { Params } from "./WebFileService";
import ReadableStream = NodeJS.ReadableStream;

export type Data = string | Buffer;

export type FileBody = ReadableStream | Buffer | string;

/**
 * 表示保存文件的结果。
 */
export interface FileSaveResult {

	/** 用于访问存储文件的文件名 */
	name: string;

	/** 保存之前文件是否不存在 */
	createNew: boolean;
}

export interface FileInfo {
	size: number;
	mtime: Date;
	data: FileBody;
}

export interface FileStore {

	/**
	 * 保存原始文件，不一定要使用 rawName 作为文件名，任何对文件的访问将以返回值为准。
	 *
	 * @param data 数据
	 * @param type 类型
	 * @param rawName 名字提示
	 */
	save(data: Data, type: string, rawName: string): Promise<FileSaveResult>;

	/**
	 * 读取原始文件。
	 *
	 * @param name 文件名
	 */
	load(name: string): Promise<FileInfo | null>;

	/**
	 * 保存缓存文件，缓存文件是原文件的优化版本。
	 *
	 * @param data 数据
	 * @param name 文件名
	 * @param params 参数
	 */
	putCache(data: Data, name: string, params: Params): Promise<void>;

	/**
	 * 读取缓存文件。
	 *
	 * @param name 文件名
	 * @param params 参数
	 */
	getCache(name: string, params: Params): Promise<FileInfo | null>;
}
