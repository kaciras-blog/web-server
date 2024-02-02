import { readFileSync } from "fs";
import { join } from "path";

/**
 * 返回 fixtures 目录下文件的完整路径。
 *
 * @param name 文件名
 * @return 完整路径
 */
export function resolveFixture(name: string) {
	return join(import.meta.dirname, "fixtures", name);
}

/**
 * 以文本的形式读取 fixtures 目录下的一个文件。
 *
 * @param name 文件名
 * @return 文件的文本内容
 */
export function readFixture(name: string) {
	return readFileSync(resolveFixture(name));
}
