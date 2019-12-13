/*
 * 自定义Axios，使其更好地支持本博客系统。
 * 【警告】Axios 0.19.0 不合并默认配置里的transport（axios/lib/core/mergeConfig.js），所以不能升级。
 */
import { Context } from "koa";
import log4js from "log4js";
import { AxiosInstance, AxiosRequestConfig, AxiosResponse } from "axios";
import hash from "hash-sum";
import http2, {
	ClientHttp2Session,
	IncomingHttpHeaders,
	IncomingHttpStatusHeader,
	SecureClientSessionOptions,
} from "http2";

type ResHeaders = IncomingHttpHeaders & IncomingHttpStatusHeader;

// 用于防止CSRF攻击的一些字段，方法是读取Cookie里的值并带在请求里。
//   CSRF_COOKIE_NAME		Cookie名
//   CSRF_PARAMETER_NAME	将值加入请求参数中的参数名
//   CSRF_HEADER_NAME		将值加入该请求头
export const CSRF_COOKIE_NAME = "CSRF-Token";
export const CSRF_PARAMETER_NAME = "csrf";
export const CSRF_HEADER_NAME = "X-CSRF-Token";

const logger = log4js.getLogger();

/**
 * 从Koa的请求中复制与身份相关的信息和一些其他必要的头部到Axios的请求中。
 * 该函数只能在服务端使用。
 *
 * @param source Koa接受到的请求
 * @param axiosConfig 代理到后端的Axios请求设置
 * @return Axios的请求设置
 */
export function configureForProxy(source: Context, axiosConfig: AxiosRequestConfig = {}) {
	const srcHeaders = source.headers;
	const distHeaders = (axiosConfig.headers = axiosConfig.headers || {});

	// 转发请求记得带上 X-Forwarded-For
	distHeaders["X-Forwarded-For"] = source.ip;

	// UA可以随便改，没啥实际用，还不如穿透了统计下客户端类型
	if (srcHeaders["user-agent"]) {
		distHeaders["User-Agent"] = srcHeaders["user-agent"];
	}

	if (srcHeaders.cookie) {
		distHeaders.Cookie = srcHeaders.cookie;
	}

	// HTTP 头是不区分大小写的，但是 Node 的 http 模块里会将其全部转换为小写
	const csrfHeader = srcHeaders[CSRF_HEADER_NAME.toLowerCase()];
	if (csrfHeader) {
		distHeaders[CSRF_HEADER_NAME] = csrfHeader;
	}

	const csrfQuery = source.query[CSRF_PARAMETER_NAME];
	if (csrfQuery) {
		axiosConfig.params = axiosConfig.params || {};
		axiosConfig.params[CSRF_PARAMETER_NAME] = csrfQuery;
	}

	return axiosConfig;
}

type ResponseParser<T, R> = (response: AxiosResponse<T>) => R;

interface CacheEntry<T> {
	value: T;
	time: Date;
	cleaner?: NodeJS.Timeout;
}

/**
 * 为 Axios 请求增加缓存的类，能够缓存解析后的内容，并在远程端返回 304 时使用缓存以避免解析过程的消耗。
 *
 * 【注意】不要再浏览器端使用，因为浏览器有缓存功能。
 *
 * 【其它方案】因为 AxiosResponse 里带有请求配置，所以可以用个拦截器来做缓存，但是它的API返回的是 AxiosResponse
 * 而不是解析后的结果，要做也只能替换其 data 字段，这样的话总感觉怪怪的。
 *
 * TODO: 直接用整个 requestConfig 作为键会有一些属性多余
 */
export class CachedFetcher<T, R> {

	private readonly cache = new Map<string, Readonly<CacheEntry<R>>>();

	private readonly axios: AxiosInstance;
	private readonly parser: ResponseParser<T, R>;
	private readonly timeToLive?: number;

	/**
	 * 创建 CachedFetcher 的实例。
	 *
	 * @param axios Axios对象，将使用它发出请求
	 * @param parser 响应解析函数
	 * @param timeToLive 缓存超时时间（毫秒），省略则永不超时
	 */
	constructor(axios: AxiosInstance, parser: ResponseParser<T, R>, timeToLive?: number) {
		this.axios = axios;
		this.parser = parser;
		this.timeToLive = timeToLive;
	}

	/**
	 * 调用 Axios.request 发送请求，并尽量使用缓存来避免解析。
	 *
	 * 【注意】Axios 默认下载全部的响应体，如果要避免下载响应体需要把 responseType 设为 "stream"。
	 *
	 * @param config Axios请求配置
	 */
	async request(config: AxiosRequestConfig) {
		const { cache, timeToLive } = this;
		const cacheKey = hash(config);
		const entry = cache.get(cacheKey);

		if (entry) {
			config.headers = config.headers || {};
			config.headers["If-Modified-Since"] = entry.time.toUTCString();
			config.validateStatus = (status) => status >= 200 && status < 400;
		}

		const response = await this.axios.request<T>(config);
		if (entry && response.status === 304) {
			return entry.value;
		}
		const result = this.parser(response);

		// 即使没有 last-modified 头也缓存，使用当前时间作为替代
		const lastModified = response.headers["last-modified"];
		const time = lastModified ? new Date(lastModified) : new Date();

		const newEntry: CacheEntry<R> = { value: result, time };
		if (timeToLive) {
			if (entry) {
				clearTimeout(entry.cleaner!);
			}
			newEntry.cleaner = setTimeout(() => cache.delete(cacheKey), timeToLive);
		}

		cache.set(cacheKey, newEntry);
		return result;
	}
}

/**
 * 修改指定 Axios 实例的 transport 配置，使其使用 http2 模块发送请求。
 *
 * @param axios 要配置的Axios实例
 * @param https 是否使用TLS链接，因为Axios的蛋疼设计，request 的选项里没有协议，必须提前指定
 * @param connectOptions 传递到 http2.connect 的选项
 */
export function configureAxiosHttp2(
	axios: AxiosInstance,
	https = false,
	connectOptions?: SecureClientSessionOptions,
) {
	const schema = https ? "https" : "http";
	const cache = new Map<string, ClientHttp2Session>();

	function request(options: any, callback: (res: any) => void) {
		let origin = `${schema}://${options.hostname}`;
		if (options.port) {
			origin += ":" + options.port;
		}

		// 创建并缓存会话链接，后端会在20秒空闲后关闭连接，被关闭后触发close事件删除缓存
		let session = cache.get(origin);
		if (!session) {
			session = http2.connect(origin, connectOptions);
			cache.set(origin, session);
			logger.trace(`新建Http2会话 -> ${origin}`);

			session.on("close", () => {
				cache.delete(origin);
				logger.trace("Http2会话过期：" + origin);
			});
		}

		const stream: any = session.request({
			...options.headers,
			":method": options.method.toUpperCase(),
			":path": options.path,
		});

		return stream.on("response", (headers: ResHeaders) => {
			stream.headers = headers;
			stream.statusCode = headers[":status"];
			callback(stream);
		});
	}

	// 修改Axios默认的transport属性，注意该属性是内部使用的，没有定义在接口里。
	// Axios 0.19.0 修改了相关逻辑，导致该字段无法合并到最终的请求中。
	(axios.defaults as any).transport = { request };
}
