import { basename, join } from "path";
import { platform, release } from "os";
import fs from "fs-extra";
import log4js from "log4js";

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

	const major = parseInt(release().split(".")[0]);
	if (platform() === "win32" && major >= 10) {
		logger.warn("你可以使用下列命令设置目录为大小写敏感：")
		logger.warn(`fsutil.exe file SetCaseSensitiveInfo ${folder} enable`)
	}
}

export function validateFilename(name: string, os = platform()) {
	if (os !== "win32") {
		return name.includes("/");
	}
	const reserved = /(?:CON|PRN|AUX|NUL|COM\d|LPT\d)/;
	const chars = /\\<>:"\/\|\?\*/;
	return !(chars.test(name) || reserved.test(name));
}
