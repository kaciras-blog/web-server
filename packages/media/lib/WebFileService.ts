import { FileInfo } from "./FileStore";

export interface Params {
	[key: string]: string;
}

interface Data {
	buffer: Buffer;
	type: string;
}

export interface SaveRequest<T = Params> {
	buffer: Buffer;
	mimetype: string;
	parameters: T;
}

export interface LoadRequest<T = Params> {

	/**
	 * 资源名字，目前的实现需要包含扩展名，虽然返回的可能与扩展名不同。
	 */
	name: string;

	/**
	 * 请求参数，可以自定义。
	 */
	parameters: T;

	/**
	 * 对应请求头中的 Accept-* 部分。
	 */
	acceptTypes: string[];
	acceptEncodings: string[];

	/**
	 * 仅靠 Accept 可能无法区分变体，比如视频只有容器格式，编码无法从标准请求头获取。
	 * 这里的解决方案是通过前端检测支持的编码，然后加到请求头中。
	 *
	 * @see https://developer.mozilla.org/en-US/docs/Web/Media/Formats/Video_codecs
	 */
	codecs: string[];
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

	save(request: SaveRequest): Promise<string>;

	load(request: LoadRequest): Promise<LoadResponse | null | undefined>;
}

type Preprocessor = (request: SaveRequest) => Promise<Data>;


