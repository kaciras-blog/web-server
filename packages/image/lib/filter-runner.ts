// 这个模块用于多个处理器串联的情况，但写完发现目前没这需求。

export interface ImageTags {
	readonly [key: string]: string;
}

export type ImageFilter = (buffer: Buffer, argument: string) => Promise<Buffer>;

// filters 要用 ES6 的 Map，因为它的遍历顺序是插入顺序
// TODO: 多个输出可以缓存中间结果
export function runFilters(buffer: Buffer, filters: Map<string, ImageFilter>, tags: ImageTags) {
	return Array.from(filters.entries())
		.filter((e) => e[0] in tags)
		.reduce((prev, [k, filter]) => prev.then((input) => filter(input, tags[k])), Promise.resolve(buffer));
}
