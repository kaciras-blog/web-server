/*
 * 自定义Axios，使其更好地支持本博客系统。
 * 【警告】Axios 0.19.0 不合并默认配置里的transport（axios/lib/core/mergeConfig.js），所以不能升级。
 */
import { Context } from "koa";
import fs from "fs-extra";
import log4js from "log4js";
import Axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from "axios";
import http2, {
	ClientHttp2Session,
	IncomingHttpHeaders,
	IncomingHttpStatusHeader,
	SecureClientSessionOptions,
} from "http2";
import hash from "hash-sum";


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

type ResponseParser<T> = (response: AxiosResponse) => T;

interface CacheEntry<T> {
	readonly value: T;
	readonly time: Date;
}

/**
 * 为 Axios 请求增加缓存的类，能够缓存解析后的内容，并在远程端返回 304 时使用缓存以避免解析过程的消耗。
 *
 * 【注意】不要再浏览器端使用，因为浏览器有缓存功能。
 *
 * TODO: 懒得写超时过期，而且直接用整个requestConfig作为键
 */
export class CachedFetcher<T> {

	private readonly cache = new Map<string, CacheEntry<T>>();

	private readonly parser: ResponseParser<T>;

	constructor(parser: ResponseParser<T>) {
		this.parser = parser;
	}

	/**
	 * 调用 Axios.request 发送请求，并尽量使用缓存来避免解析。
	 *
	 * 【注意】Axios 默认下载全部的响应体，如果要避免下载响应体需要把 responseType 设为 "stream"。
	 *
	 * @param config Axios请求配置
	 */
	async request(config: AxiosRequestConfig) {
		const cacheKey = hash(config);
		const entry = this.cache.get(cacheKey);

		if (entry) {
			config.headers = config.headers || {};
			config.headers["If-Modified-Since"] = entry.time.toUTCString();
			config.validateStatus = (status) => status >= 200 && status < 400;
		}

		const response = await Axios.request(config);
		if (response.status === 304) {
			return entry!.value;
		}
		const result = this.parser(response);
		this.cache.set(cacheKey, { value: result, time: new Date() });

		return result;
	}
}

/**
 * 修改指定 Axios 实例的 transport 配置，使其使用 NodeJS 的 http2 模块发送请求。
 *
 * @param axios Axios实例
 * @param https transport 的参数里竟然不带协议？还得手动指定下
 * @param connectOptions 传递到 http2.connect 的选项
 */
export function adaptAxiosHttp2(axios: AxiosInstance, https = false, connectOptions?: SecureClientSessionOptions) {
	const schema = https ? "https" : "http";
	const cache = new Map<string, ClientHttp2Session>();

	function request(options: any, callback: (res: any) => void) {
		let origin = `${schema}://${options.hostname}`;
		if (options.port) {
			origin += ":" + options.port;
		}

		// 创建并缓存会话链接，后端会在20秒空闲后关闭连接，被关闭后触发close事件删除缓存
		let client = cache.get(origin);
		if (!client) {
			client = http2.connect(origin, connectOptions);
			cache.set(origin, client);
			client.on("close", () => cache.delete(origin));
			logger.trace(`创建新的Http2会话 -> ${origin}`);
		}

		const stream: any = client.request({
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

/**
 * 配置全局Axios实例的便捷函数。
 *
 * @param https 因为Axios的蛋疼设计，必须在这里指定是否用HTTPS
 * @param trusted 信任的证书，或是true忽略证书检查
 */
export async function configureGlobalAxios(https?: boolean, trusted?: string | true) {
	if (typeof trusted === "string") {
		const ca = await fs.readFile(trusted);
		adaptAxiosHttp2(Axios, true, { ca });
	} else {
		if (trusted) {
			process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
		}
		adaptAxiosHttp2(Axios, true);
	}
}
