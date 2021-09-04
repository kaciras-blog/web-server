import mime from "mime-types";
import { xxHash3_128 } from "@kaciras-blog/nativelib";
import { FileStore } from "./FileStore";
import { LoadRequest, LoadResponse } from "./WebFileService";

/**
 * 对数据执行 Hash 运算，返回 20 个字符的 base64 字符串，可用作文件名。
 *
 * 该函数很快无需异步。
 *
 * 【Hash-Flooding Attack】
 * 非加密 Hash 有恶意碰撞的风险，在允许公开上传时需要注意。
 *
 * 【大小写敏感性】
 * base64 是大小写敏感的，但有些文件系统不敏感（HFS+, exFAT, ...），
 * 在这些系统上，base64 每个字符的种类由 64 降为 36，通过计算：
 *
 *   log(2, pow(36, N)) / log(2, pow(64, N))
 * = log(36) / log(64)
 * = 0.86165416690705206048457964798261
 *
 * 可以得出，此时 base64 有效位数降低为原来的 0.86 倍。
 * 20 位 base64 拥有 120 bit 信息，在不敏感的系统上降低为 103.4 bit，碰撞几率仍然很低。
 *
 * 【碰撞率】
 * 通过生日问题可以计算，103 bit 的 Hash 需要一千四百亿输入才能达到一亿分之一的碰撞率。
 * https://en.wikipedia.org/wiki/Birthday_attack
 *
 * 【为什么不用 HEX】
 * 我有强迫症，能省几个字符坚决不用更长的。
 *
 * @param buffer 数据
 * @return 字符串形式的 Hash 值
 */
export function hashName(buffer: Buffer | string) {
	return xxHash3_128(buffer, "base64u").slice(0, 20);
}

type SelectFn = () => Promise<LoadResponse | null>;

export class FileSelector {

	static for(request: LoadRequest, store: FileStore) {
		return new FileSelector(request, store);
	}

	private readonly request: LoadRequest;
	private readonly store: FileStore;

	private chain = Promise.resolve<LoadResponse | null>(null);

	private constructor(request: LoadRequest, store: FileStore) {
		this.request = request;
		this.store = store;
	}

	private addCandidate(selectFn: SelectFn) {
		this.chain = this.chain.then(file => file || selectFn());
	}

	selectFirstMatch() {
		return this.chain;
	}

	addCache(mimetype: string) {
		this.addCandidate(async () => {
			const type = mime.extension(mimetype);
			const file = await this.store.getCache(this.request.name, { type });
			if (!file) {
				return null;
			}
			return { file, mimetype };
		});
		return this;
	}

	addOriginal() {
		this.addCandidate(() => this.store.load(this.request.name));
		return this;
	}
}
