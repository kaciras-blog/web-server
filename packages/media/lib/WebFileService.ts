import type { Range } from "range-parser";

export interface WebFile {
	filename: string;
	buffer: Buffer;
	mimetype: string;
}

export interface Params {
	[key: string]: string;
}

export type FileReader = (range: Range) => NodeJS.ReadableStream | Buffer | string;

/**
 *
 */
export interface WebFileService {

	save(file: WebFile, params: Params): Promise<any>;

	load(name: string, accept: Params, params: Params): Promise<FileReader | null>;

	getAllNames(): Promise<string[]>;
}
