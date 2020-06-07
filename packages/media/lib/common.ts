import { murmurHash128x64 } from "murmurhash-native";

/**
 * 对数据执行hash运算，返回一个固定长度且唯一的字符串。
 *
 * 该函数运算速度很快，暂时不用异步，详情见：
 * __perfs__\hash-mane.ts
 *
 * 【Hash-Flooding Attack】
 * murmurHash3 即使随机了种子仍有恶意碰撞的风险（WIKI百科），
 * 但用于文件名时即使冲突也没有什么意义，故不存在安全问题。
 *
 * 【为何不用base64】
 * base64 是大小写敏感的，但有些文件系统不敏感（HFS+, exFAT, etc...），
 * 在这些文件系统上使用 base64 会提升碰撞率。
 *
 * @param buffer 数据
 * @return 字符串标识
 */
export function hashName(buffer: Buffer) {
	return murmurHash128x64(buffer, "hex") as string;
}
