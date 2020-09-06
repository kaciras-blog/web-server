import { basename, join } from "path";
import { platform, release } from "os"
import fs from "fs-extra";
import log4js from "log4js";
import { xxHash3_128 } from "@kaciras-blog/nativelib";

/**
 * 对数据执行 Hash 运算，返回一个固定长度且唯一的字符串，可用于文件名。
 *
 * 该函数运算速度很快，暂时不用异步，详情见：
 * __perfs__\hash-mane.ts
 *
 * 【Hash-Flooding Attack】
 * 非加密 Hash 有恶意碰撞的风险，用在哈希表上会导致退化从而产生性能问题。
 * 但对于本项目来说即使冲突也没有什么意义，故不存在安全问题。
 *
 * 【文件系统的大小写敏感性】
 * base64 是大小写敏感的，但有些文件系统不敏感（HFS+, exFAT, etc...），
 * 使用大小写不敏感的文件系统会提升碰撞率。
 * 不过即便如此，等价的 Hash 位数也只是从 128 降低为 112，碰撞的可能性仍然微乎其微。
 *
 * 【为什么不用HEX】
 * 我有强迫症，能省几个字符坚决不用更长的，至于某些文件系统大小写不敏感那是它的事，
 * 只要 URL 是敏感的我这就要用！
 *
 * 【末尾等号的问题】
 * 最后两个填充的等号看着很多余就删了，解码时记得把等号加回来。
 *
 * @param buffer 数据
 * @return 22位字符串标识
 */
export function hashName(buffer: Buffer) {
	return xxHash3_128(buffer, "base64u").slice(0, 22);
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
