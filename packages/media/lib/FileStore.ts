import { Params } from "./WebFileService";

export interface FileSaveResult {
	filename: string;
	alreadyExists: boolean;
}

export interface FileStore {

	save(filename: string, buffer: Buffer): Promise<FileSaveResult>;

	load(name: string): Promise<ReadableStream | null>;

	getCache(filename: string, params: Params): Promise<ReadableStream | null>;

	putCache(filename: string, buffer: any, params: Params): Promise<void>;
}
