import { xxHash3_128 } from "@kaciras-blog/nativelib";

/**
 * 对数据执行 Hash 运算，返回 20 个字符的 base64 字符串，可用作文件名。
 *
 * 该函数很快无需异步。
 *
 * 【Hash-Flooding Attack】
 * 非加密 Hash 有恶意碰撞的风险，用在哈希表上会导致退化从而产生性能问题。
 * 但对于本项目来说，即使冲突也没有什么意义，故不存在安全问题。
 *
 * 【文件系统的大小写敏感性】
 * base64 是大小写敏感的，但有些文件系统不敏感（HFS+, exFAT, etc...），
 * 使用大小写不敏感的文件系统会提升碰撞率。
 *
 * 在不敏感的系统上，base64 每个字符的种类由 64 降为 36，通过计算：
 *
 *   log(2, pow(36, N)) / log(2, pow(64, N))
 * = log(36) / log(64)
 * = 0.86165416690705206048457964798261
 *
 * 可以得出，在不敏感的系统上 base64 有效位数降低为原来的 0.86 倍。
 * 20 位 base64 拥有 120 bit 信息，在不敏感的系统上降低为 103.4 bit，碰撞几率仍然很低。
 *
 * 【碰撞率】
 * 通过生日问题可以计算，103 bit 的 Hash 需要一千四百亿输入才能达到一亿分之一的碰撞率。
 * https://en.wikipedia.org/wiki/Birthday_attack
 *
 * 当然这要求 Hash 算法没有缺陷，目前使用的 xxHash3_128 没有足够的分析所以不知道行不行。
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
