import { FileInfo } from "./FileStore";

export interface Params {
	[key: string]: string;
}

export interface MediaSaveRequest {
	buffer: Buffer;
	mimetype: string;
	rawName: string;
	parameters: Params;
}

export interface MediaLoadRequest {
	name: string;
	acceptTypes: string[];
	acceptEncodings: string[];
	parameters: Params;
}

export interface MediaResponse {
	file: FileInfo;
	mimetype: string;
	encoding: string;
}

export interface WebFileService {

	save(request: MediaSaveRequest): Promise<string>;

	load(request: MediaLoadRequest): Promise<MediaResponse>;
}
