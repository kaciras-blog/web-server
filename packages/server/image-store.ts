import fs from "fs-extra";
import path from "path";
import { ImageTags } from "./image-filter";

// 好像常见格式的图片都能够从数据里读取出格式，那么文件名里的type就不需要，
// 但我有时候会从资源管理器直接看看图片目录，所以还是把type带上作为扩展名。
export interface ImageKey {
	name: string;
	type: string;
}

export type ImageStore = (key: ImageKey) => LocalFileSlot;

/**
 * 存储图片及其衍生图（目前叫缓存）的类。
 *
 * 按标签划分目录 vs. 按图片划分目录：
 * 按图片划分的话每个图片跟它的衍生缓存放在一个目录，这样做找一个图片的所有衍生图很容易，而且不同的
 * 图片之间没有关联是可以隔离的。按标签划分的优势是一旦标签的处理逻辑有改动，直接就能清理相应的衍生图，
 * 而且原图都在一个目录里好做备份。目前来看按标签划分更好。
 */
export class LocalFileSlot {

	private readonly root: string;
	private readonly key: ImageKey;

	constructor(root: string, name: ImageKey) {
		this.root = root;
		this.key = name;
	}

	async save(buffer: Buffer | string) {
		const file = this.originPath();
		await fs.ensureFile(file);
		return fs.writeFile(file, buffer);
	}

	load() {
		return fs.readFile(this.originPath());
	}

	exists() {
		return fs.pathExists(this.originPath());
	}

	getCache(tags: ImageTags) {
		const file = this.cachePath(tags);
		return fs.pathExists(file).then((exists) => exists ? file : null);
	}

	async putCache(tags: ImageTags, buffer: Buffer | string) {
		const file = this.cachePath(tags);
		await fs.ensureFile(file);
		return fs.writeFile(file, buffer);
	}

	private originPath() {
		const { name, type } = this.key;
		return path.join(this.root, "origin", `${name}.${type}`);
	}

	// Object.keys(tags) 对于非ASCII字符串返回的顺序不确定，必须排序一下
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
	return (key: ImageKey) => new LocalFileSlot(root, key);
}
