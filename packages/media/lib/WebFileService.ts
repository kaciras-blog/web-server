export interface Params {
	[key: string]: string;
}

export interface MediaSaveRequest {
	buffer: Buffer;
	mimetype: string;
	name: string;
	parameters: Params;
}

export interface MediaLoadRequest {
	name: string;
	acceptTypes: string[];
	acceptEncodings: string[];
	parameters: Params;
}

export interface WebFileService {

	save(request: MediaSaveRequest): Promise<string>;

	load(request: MediaLoadRequest): Promise<any>;
}
