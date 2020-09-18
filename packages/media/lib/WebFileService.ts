import { FileInfo } from "./FileStore";

export interface Params {
	[key: string]: string;
}

export interface SaveRequest {
	buffer: Buffer;
	mimetype: string;
	rawName: string;
	parameters: Params;
}

export interface LoadRequest {
	name: string;
	acceptTypes: string[];
	acceptEncodings: string[];
	parameters: Params;
}

export interface SaveResponse {
	url: string;
}

export interface LoadResponse {
	file: FileInfo;
	mimetype: string;
	encoding?: string;
}

export interface WebFileService {

	save(request: SaveRequest): Promise<SaveResponse>;

	load(request: LoadRequest): Promise<LoadResponse | null>;
}
