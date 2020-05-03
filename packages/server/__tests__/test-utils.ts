import path from "path";
import fs from "fs-extra";

export const FIXTURE_DIR = path.join(__dirname, "fixtures");

/**
 * 返回fixtures目录下文件的完整路径。
 *
 * @param name 文件名
 * @return 完整路径
 */
export function resolveFixture(name: string) {
	return path.join(FIXTURE_DIR, name);
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

/**
 * 返回一个Promise，在指定的时间后完成，可用于模拟耗时的操作，或搭配FakeTimers实现异步等待。
 *
 * @param time 时间，毫秒
 * @return 在指定的时间后完成的Promise
 */
export function sleep(time: number = 0) {
	return new Promise((resolve) => setTimeout(resolve, time));
}
