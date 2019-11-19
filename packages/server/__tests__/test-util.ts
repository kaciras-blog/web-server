import path from "path";
import fs from "fs-extra";

/**
 * 返回fixtures目录下文件的完整路径。
 *
 * @param name 文件名
 * @return 完整路径
 */
export function resolveFixture(name: string) {
	return path.join(__dirname, "fixtures", name);
}

/**
 * 以文本的形式读取fixtures目录下的一个文件。
 *
 * @param name 文件名
 * @return 文件的文本内容
 */
export function readFixtureText(name: string) {
	return fs.readFileSync(resolveFixture(name), { encoding: "utf8" });
}
