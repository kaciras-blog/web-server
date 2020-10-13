import { FileInfo } from "./FileStore";

export interface Params {
	[key: string]: string;
}

export interface SaveRequest<T = Params> {
	buffer: Buffer;
	mimetype: string;
	rawName: string;
	parameters: T;
}

export interface LoadRequest<T = Params> {
	name: string;
	acceptTypes: string[];
	acceptEncodings: string[];
	parameters: T;
}

/**
 * 保存请求的响应信息，这里只定义了必须的属性，实现时可以添加其他属性。
 */
export interface SaveResponse {
	url: string;
}

/**
 * 下载响应的信息，用于生成 HTTP 响应。
 */
export interface LoadResponse {
	file: FileInfo;
	mimetype: string;
	encoding?: string;
}

export interface WebFileService {

	save(request: SaveRequest): Promise<SaveResponse>;

	load(request: LoadRequest): Promise<LoadResponse | null>;
}
