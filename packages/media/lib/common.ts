import { basename, join } from "path";
import fs from "fs-extra";
import { murmurHash128x64 } from "murmurhash-native";
import log4js from "log4js";

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
 * 【Hash-Flooding Attack】
 * murmurHash3 即使随机了种子仍有恶意碰撞的风险（WIKI百科），
 * 但用于文件名时即使冲突也没有什么意义，故不存在安全问题。
 *
 * 【文件系统的大小写敏感性】
 * base64 是大小写敏感的，但有些文件系统不敏感（HFS+, exFAT, etc...），
 * 使用大小写不敏感的文件系统会提升碰撞率，应该避免。
 *
 * 为什么不用hex？
 *
 * @param buffer 数据
 * @return 字符串标识
 */
export function hashName(buffer: Buffer) {
	return makeFilenameSafe(murmurHash128x64(buffer, "base64") as string);
}

/**
 * 检查指定目录（不包括子目录）下的文件名是不是大小写敏感的。
 *
 * 【第三方库】
 * 虽然NPM上也有几个相同功能的包，但由于代码简单所以自己写了。
 *
 * @param folder 要检查的目录
 * @return 如果是返回true，否则false
 */
export function isCaseSensitive(folder: string) {
	const uppercase = fs.mkdtempSync(join(folder, ".TMP-"));

	let lowercase = basename(uppercase).replace("TMP", "tmp")
	lowercase = join(folder, lowercase);

	try {
		fs.accessSync(lowercase);
		return false;
	} catch (e) {
		return true;
	} finally {
		fs.unlinkSync(uppercase);
	}
}

export function checkCaseSeneitive(folder: string) {
	if (isCaseSensitive(folder)) {
		return;
	}
	log4js.getLogger().warn(`${folder} 下的文件名对大小写不敏感，这会提高碰撞率`)
}
