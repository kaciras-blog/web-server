import fs from "fs-extra";
import path from "path";
import { ImageTags } from "./image-filter";

export interface ImageName {
	hash: string;
	type: string;
}

/**
 * 处理图片存取的类，
 */
export class LocalFileStore {

	private readonly root: string;

	constructor(root: string) {
		this.root = root;
	}

	async save(name: ImageName, buffer: Buffer | string) {
		const file = this.originPath(name);
		await fs.ensureFile(file);
		return fs.writeFile(file, buffer);
	}

	load(name: ImageName) {
		return fs.readFile(this.originPath(name));
	}

	exists(name: ImageName) {
		return fs.pathExists(this.originPath(name));
	}

	getCache(name: ImageName, tags: ImageTags) {
		const file = this.cachePath(name, tags);
		return fs.pathExists(file).then((exists) => exists ? file : null);
	}

	async putCache(name: ImageName, tags: ImageTags, buffer: Buffer | string) {
		const file = this.cachePath(name, tags);
		await fs.ensureFile(file);
		return fs.writeFile(file, buffer);
	}

	private originPath(name: ImageName) {
		return path.join(this.root, "origin", `${name.hash}.${name.type}`);
	}

	private cachePath({ hash, type }: ImageName, tags: ImageTags) {
		const tagValues = Object.keys(tags).sort().map((key) => tags[key]);
		if (tags.type) {
			type = tags.type;
		}
		return path.join(this.root, "cache", ...tagValues, `${hash}.${type}`);
	}
}
