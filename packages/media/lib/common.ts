import { murmurHash128x64 } from "murmurhash-native";

const BASE64_REPLACE_TABLE = { "/": "_", "+": "-", "=": "" };

/**
 * Base64 标准代码表里有 "/" 和 "+" 两个字符，用在文件名和URL上会出现问题。
 * 该函数将其分别替换为 "_" 和 "-"，并去除末尾填充的等号。
 *
 * @internal
 * @param base64 原Base64字符串
 * @return 替换后的字符串
 *
 * @see https://tools.ietf.org/html/rfc4648#section-5
 */
function makeFilenameSafe(base64: string) {
	type UnsafeChar = keyof typeof BASE64_REPLACE_TABLE;
	return base64.replace(/[+/=]/g, c => BASE64_REPLACE_TABLE[c as UnsafeChar])
}

/**
 * 对数据执行hash运算，返回一个固定长度且唯一的字符串。
 *
 * 该函数运算速度很快，暂时不用异步，详情见：
 * __perfs__\hash-mane.ts
 *
 * @param buffer 数据
 * @return 字符串标识
 */
export function hashName(buffer: Buffer) {
	return makeFilenameSafe(murmurHash128x64(buffer, "base64") as string);
}
