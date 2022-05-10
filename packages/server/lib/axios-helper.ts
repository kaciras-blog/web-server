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
