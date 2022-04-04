import { xxHash3_128 } from "@kaciras-blog/nativelib";
import { FileBody } from "./FileStore";

/**
 * 对数据执行 Hash 运算，返回 20 个字符的 url-safe base64 字符串。
 * 该函数很快无需异步。
 *
 * 之所以选择 20 个字符，是因为它有 120 bit 信息量，且能被 6(base64) 和 8(byte) 整除，
 * 同时也是最接近原始输出 128 的长度。
 *
 * 【Hash-Flooding Attack】
 * 非加密 Hash 有恶意碰撞的风险，在允许公开上传时需要注意。
 *
 * 【大小写敏感性】
 * base64 是大小写敏感的，但有些文件系统不敏感（HFS+, exFAT, ...），
 * 在这些系统上，base64 每个字符的种类由 64 降为 38，通过计算：
 *
 *   log(2, pow(38, N)) / log(2, pow(64, N))
 * = log(38) / log(64)
 * ≈ 0.875
 *
 * 可以得出，此时 base64 有效位数降低为原来的 0.875 倍。
 * 在不敏感的系统上信息量由 120 bit 降低为 104.95 bit，碰撞几率仍然很低。
 *
 * 通过生日问题可以计算，104 bit 的 Hash 需要一千四百亿输入才能达到一亿分之一的碰撞率。
 * https://en.wikipedia.org/wiki/Birthday_attack
 *
 * 【为什么不用 HEX】
 * 我有强迫症，能省几个字符坚决不用更长的，而且文件名太长也不好看。
 *
 * @param buffer 数据
 * @return 20 个字符的 base64 字符串形式的 Hash 值
 */
export function hashName(buffer: Buffer) {
	return xxHash3_128(buffer).toString("base64url").slice(0, 20);
}

/**
 * 将 FileBody 的多种数据类型类型统一转换为 Buffer。
 *
 * 如果是字符串则使用 UTF-8 解码。
 */
export async function bodyToBuffer(body: FileBody) {
	if (typeof body === "string") {
		return Buffer.from(body);
	} else if (Buffer.isBuffer(body)) {
		return body;
	}

	const chunks = [];
	for await (const chunk of body) {
		chunks.push(chunk);
	}
	return Buffer.concat(chunks as Buffer[]);
}
