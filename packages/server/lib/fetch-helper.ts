import { BaseContext } from "koa";

export function addQuery(url: string, params: Record<string, any>) {
	const search = new URLSearchParams();

	// URLSearchParams 会将 undefined 值序列化为字符串，这里处理下。
	// https://github.com/whatwg/url/issues/427
	for (const k of Object.keys(params)) {
		if (params[k] !== undefined)
			search.set(k, params[k]);
	}

	const query = search.toString();
	return query ? `${url}?${query}` : url;
}

export function getProxyHeaders(ctx: BaseContext) {
	return {
		"X-Forwarded-For": ctx.ip,
		Cookie: ctx.headers.cookie!,
	};
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
