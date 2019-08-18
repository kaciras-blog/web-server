/*
 * 自定义Axios，使其更好地支持本博客系统。
 * 【警告】Axios 0.19.0 不合并默认配置里的transport（axios/lib/core/mergeConfig.js），所以不能升级。
 */
import { Context } from "koa";
import fs from "fs-extra";
import Axios, { AxiosInstance, AxiosRequestConfig } from "axios";
import http2, {
	IncomingHttpHeaders,
	IncomingHttpStatusHeader,
	ClientHttp2Session,
	SecureClientSessionOptions,
} from "http2";


type ResHeaders = IncomingHttpHeaders & IncomingHttpStatusHeader;

export const CSRF_COOKIE_NAME = "CSRF-Token";
export const CSRF_PARAMETER_NAME = "csrf";
export const CSRF_HEADER_NAME = "X-CSRF-Token";

/**
 * 复制请求的身份相关信息，以及一些其他必要的头部。该函数只能在服务端使用。
 *
 * @param requestConfig 代理到后端的Axios请求
 * @param source Koa接受到的源请求
 */
export function configureForProxy(requestConfig: AxiosRequestConfig, source: Context) {
	const srcHeaders = source.headers;
	const distHeaders = (requestConfig.headers = requestConfig.headers || {});

	// 转发请求记得带上 X-Forwarded-For
	distHeaders["X-Forwarded-For"] = source.ip;

	// UA可以随便改，没啥实际用，还不如穿透了统计下客户端类型
	if (srcHeaders["user-agent"]) {
		distHeaders["User-Agent"] = srcHeaders["user-agent"];
	}

	if (srcHeaders.cookie) {
		distHeaders.Cookie = srcHeaders.cookie;
	}

	const csrfHeader = srcHeaders[CSRF_HEADER_NAME];
	if (csrfHeader) {
		distHeaders[CSRF_HEADER_NAME] = csrfHeader;
	}

	const csrfQuery = source.query[CSRF_PARAMETER_NAME];
	if (csrfQuery) {
		requestConfig.headers = requestConfig.headers || {};
		requestConfig.headers[CSRF_PARAMETER_NAME] = csrfQuery;
	}

	return requestConfig;
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

		// 缓存会话链接，会话默认有120秒超时，超时后触发close事件删除缓存
		let client = cache.get(origin);
		if (!client) {
			client = http2.connect(origin, connectOptions);
			cache.set(origin, client);
			client.on("close", () => cache.delete(origin));
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

	// 修改Axios默认的transport属性，注意该属性是内部使用没有定义在接口里
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
