import { FileInfo } from "./FileStore.js";

/*
 * 【文件的多层封装】
 * 一个文件可能有多层封装，如果只看浏览器支持的，最多有三层，以视频为例：
 * 1）最内层是视频流的编码，比如 H.264、HEVC、AV1。
 * 2）容器格式，比如 mp4、webm、mkv。
 * 3）打包压缩（虽然视频很少用），比如 gzip、br。
 *
 * HTTP 协议仅支持后两者，即 Accept 和 Accept-Encoding，而最内层的编码却没有对应的头部。
 * 如果要原生使用，通常是在 HTML 靠 <source> 标签选择，但这与本项目的后端选择策略相悖。
 *
 * 目前的想法是在前端通过 HTMLMediaElement.canPlayType() 检测支持，然后加入请求头。
 * 这部分比较复杂，因为编码还可以细分各种 Profile，实现可以参考：
 * https://cconcolato.github.io/media-mime-support
 * https://evilmartians.com/chronicles/better-web-video-with-av1-codec
 */

export type Params = Record<string, string | undefined>;

/**
 * <h2>从内容检测类型？</h2>
 * 这样做可以去掉 type 属性，但因为其复杂度较高，不仅需要各种检测库；
 * 未来是否要支持同数据不同处理也不好说，所以目前还是从请求中指定类型。
 */
export interface SaveRequest<T = Params> {
	buffer: Buffer;
	type: string;
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
	 * 仅靠 Accept 可能无法区分变体，比如视频编码无法从标准请求头获取。
	 * 这里的解决方案是通过前端检测支持的编码，然后加到请求头中。
	 *
	 * @see https://developer.mozilla.org/en-US/docs/Web/Media/Formats/Video_codecs
	 */
	codecs: string[];
}

/**
 * 下载响应的信息，可用于生成 HTTP 响应。
 */
export interface LoadResponse {

	/** 资源文件信息 */
	file: FileInfo;

	/** 资源的类型，例如 svg、mp4 */
	type: string;

	/**
	 * 外层包装的编码，通常是 gzip 或 br。
	 */
	encoding?: string;
}

/**
 * 该接口是 @kaciras-blog/media 库的入口，表示处理一类媒体资源的服务。
 */
export interface MediaService {

	/**
	 * 保存一个媒体文件。
	 *
	 * @param request 保存请求对象
	 * @return 资源名字，用于 LoadRequest 的 name 属性。
	 */
	save(request: SaveRequest): Promise<string>;

	/**
	 * 获取指定的媒体文件。
	 *
	 * @param request 加载请求对象
	 * @return 资源对象，如果是 falsy 值则表示不存在。
	 */
	load(request: LoadRequest): Promise<LoadResponse | null | undefined>;
}
