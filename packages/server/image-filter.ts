import { BaseError } from "make-error";

export interface ImageTags {
	readonly [key: string]: string;
}

export type ImageFilter = (buffer: Buffer, argument: string) => Promise<Buffer>;

// JS 这垃圾语言实现个自定义异常坑真是多……
// @formatter:off
/** 图片的数据无效或损坏 */
export class InvalidImageError extends BaseError {
	constructor(message?: string) { super(message); }
}

/** 某个处理过程不适用于该图片 */
export class ImageUnhandlableError extends BaseError {
	constructor(message?: string) { super(message); }
}
// @formatter:on

// filters 要用 ES6 的 Map，因为它的遍历顺序是插入顺序
// TODO: 多个输出可以缓存中间结果
export function runFilters(buffer: Buffer, filters: Map<string, ImageFilter>, tags: ImageTags) {
	return Array.from(filters.entries())
		.filter((e) => e[0] in tags)
		.reduce((prev, [k, filter]) => prev.then((input) => filter(input, tags[k])), Promise.resolve(buffer));
}
