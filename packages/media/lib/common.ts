import { murmurHash128x64 } from "murmurhash-native";

const BASE64_REPLACE_TABLE = { "/": "_", "+": "-", "=": "" };

function makeFilenameSafe(base64: string | Buffer) {
	type UnsafeChar = keyof typeof BASE64_REPLACE_TABLE;
	return (base64 as string).replace(/[+/=]/g, c => BASE64_REPLACE_TABLE[c as UnsafeChar])
}

/**
 * 对数据执行hash运算，返回一个唯一的字符串。
 *
 * @param buffer 数据
 * @return 字符串标识
 */
export function hashName(buffer: Buffer) {
	return makeFilenameSafe(murmurHash128x64(buffer, "base64"));
}
