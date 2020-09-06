import fs from "fs-extra";
import path from "path";
import { ImageTags } from "./filter-runner";

// 好像常见格式的图片都能够从数据里读取出格式，那么文件名里的type就不需要，
// 但我有时候会从资源管理器直接看看图片目录，所以还是把type带上作为扩展名。
export interface ImageKey {
	name: string;
	type: string;
}

export type ImageStore = (key: ImageKey) => LocalFileSlot;

/**
 * 图片存储槽，控制一张图片及其缓存的存取。
 *
 * 【按标签划分目录 vs. 按图片划分目录】
 * 按图片划分的话每个图片跟它的缓存缓存放在一个目录，这样做找一个图片的所有缓存很容易，而且不同的
 * 图片之间没有关联是可以隔离的。按标签划分的优势是一旦标签的处理逻辑有改动，直接就能清理相应的缓存，
 * 而且原图都在一个目录里好做备份。目前来看按标签划分更好。
 */
export class LocalFileSlot {

	private readonly root: string;
	private readonly key: ImageKey;

	constructor(root: string, name: ImageKey) {
		this.root = root;
		this.key = name;
	}

	/** 保存图片的原图 */
	async save(buffer: Buffer | string) {
		const file = this.originPath();
		await fs.ensureFile(file);
		return fs.writeFile(file, buffer);
	}

	/** 读取图片的原图 */
	load() {
		return fs.readFile(this.originPath());
	}

	/** 判断该图片是否存在 */
	exists() {
		return fs.pathExists(this.originPath());
	}

	/** 获取缓存图的路径，如果不存在则为null */
	getCache(tags: ImageTags) {
		const file = this.cachePath(tags);
		return fs.pathExists(file).then((exists) => exists ? file : null);
	}

	/** 保存缓存图 */
	async putCache(tags: ImageTags, buffer: Buffer | string) {
		const file = this.cachePath(tags);
		await fs.ensureFile(file);
		return fs.writeFile(file, buffer);
	}

	private originPath() {
		return path.join(this.root, "image", `${this.key.name}.${this.key.type}`);
	}

	// Object.keys(tags) 对于非 ASCII 字符串的键返回的顺序不确定，必须排序
	// TODO: 两个不同的键有相同的值怎么办
	private cachePath(tags: ImageTags) {
		const tagValues = Object.keys(tags).sort().map((key) => tags[key]);
		let { type } = this.key;
		if (tags.type) {
			type = tags.type;
		}
		return path.join(this.root, "cache", ...tagValues, `${this.key.name}.${type}`);
	}
}

export function localFileStore(root: string) {
	fs.ensureDirSync(path.join(root, "image"));
	fs.ensureDirSync(path.join(root, "cache"));
	return (key: ImageKey) => new LocalFileSlot(root, key);
}
