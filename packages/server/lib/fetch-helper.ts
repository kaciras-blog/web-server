import { URL } from "url";
import { BaseContext } from "koa";

/**
 * 根据基准 URL，URL 片段和查询参数来组合成完整的 URL。
 *
 * <h2>参数的处理</h2>
 * URLSearchParams 会将 undefined 值序列化为字符串，这里处理下。
 * https://github.com/whatwg/url/issues/427
 *
 * @param base 基准 URL，在 url 是相对时才会起效
 * @param url 如果是相对 URL，则会将 base 用作基准
 * @param params 键值对形式的参数
 */
export function buildURL(
	base: string | null | undefined,
	url: string,
	params: Record<string, any>,
) {
	// 增大 base 的类型范围到任意 falsy 值。
	base ||= undefined;
	const parsed = new URL(url, base);

	const { searchParams } = parsed;
	for (const k of Object.keys(params)) {
		if (params[k] !== undefined)
			searchParams.set(k, params[k]);
	}

	return parsed.toString();
}

/**
 * 获取一个 HTTP 请求头，用于表明请求是被代理的，并包含必要的信息。
 *
 * @param ctx Koa 请求上下文
 */
export function getProxyHeaders(ctx: BaseContext) {
	const headers: HeadersInit = {
		"X-Forwarded-For": ctx.ip,
	};
	if (ctx.headers.cookie) {
		headers.Cookie = ctx.headers.cookie;
	}
	return headers;
}

type ResponseParser<R> = (response: Response) => Promise<R>;

interface CacheEntry {
	value: unknown;
	time: Date;
	cleaner?: NodeJS.Timeout;
}

export class CachedFetcher {

	private readonly cache = new Map<string, Readonly<CacheEntry>>();

	private readonly timeToLive?: number;

	/**
	 * 创建 CachedFetcher 的实例。
	 *
	 * @param timeToLive 缓存超时时间（毫秒），省略则永不超时
	 */
	constructor(timeToLive?: number) {
		this.timeToLive = timeToLive;
	}

	async request<R>(url: string, parser: ResponseParser<R>, init: RequestInit = {}) {
		const { cache, timeToLive } = this;
		const entry = cache.get(url);

		if (entry) {
			init.headers = { "If-Modified-Since": entry.time.toUTCString() };
		}

		const response = await fetch(url, init);
		if (entry && response.status === 304) {
			return entry.value as R;
		}
		const result = await parser(response);

		// 即使没有 last-modified 头也缓存，使用当前时间作为替代
		const lastModified = response.headers.get("last-modified");
		const time = lastModified ? new Date(lastModified) : new Date();

		const newEntry: CacheEntry = { value: result, time };
		if (timeToLive) {
			if (entry) {
				clearTimeout(entry.cleaner!);
			}
			newEntry.cleaner = setTimeout(() => cache.delete(url), timeToLive);
		}

		cache.set(url, newEntry);
		return result;
	}
}
