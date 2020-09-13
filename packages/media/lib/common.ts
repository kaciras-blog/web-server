import { basename, join } from "path";
import { platform, release } from "os"
import fs from "fs-extra";
import log4js from "log4js";
import { xxHash3_128 } from "@kaciras-blog/nativelib";

/**
 * 对数据执行 Hash 运算，返回 20 个字符的 base64 字符串，可用于文件名。
 * 该函数运算速度很快无需异步。
 *
 * 【Hash-Flooding Attack】
 * 非加密 Hash 有恶意碰撞的风险，用在哈希表上会导致退化从而产生性能问题。
 * 但对于本项目来说即使冲突也没有什么意义，故不存在安全问题。
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
 *
 * 20 位 base64 拥有 120 bit 信息，在不敏感的系统上降低为 103.4 bit，碰撞几率仍然很低。
 *
 * 【为什么不用 HEX】
 * 我有强迫症，能省几个字符坚决不用更长的。
 *
 * @param buffer 数据
 * @return 字符串形式的 Hash 值
 */
export function hashName(buffer: Buffer) {
	return xxHash3_128(buffer, "base64u").slice(0, 20);
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
		fs.rmdirSync(uppercase);
	}
}

/**
 * 检查指定的目录是否是大小写敏感的，如果不敏感会显示一个警告。
 *
 * @param folder 目录
 */
export function checkCaseSensitive(folder: string) {
	if (isCaseSensitive(folder)) {
		return;
	}
	const logger = log4js.getLogger();
	logger.warn(`${folder} 下的文件名对大小写不敏感，这会提高碰撞率`);

	const majorVersion = parseInt(release().split(".")[0]);
	if (platform() === "win32" && majorVersion >= 10) {
		logger.warn("你可以使用下列命令设置目录为大小写敏感：")
		logger.warn(`fsutil.exe file SetCaseSensitiveInfo ${folder} enable`)
	}
}
