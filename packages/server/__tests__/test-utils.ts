import { fileURLToPath } from "url";
import { join } from "path";
import { readFileSync } from "fs";

export const FIXTURE_DIR = join(fileURLToPath(import.meta.url), "../fixtures");

/**
 * 返回fixtures目录下文件的完整路径。
 *
 * @param name 文件名
 * @return 完整路径
 */
export function resolveFixture(name: string) {
	return join(FIXTURE_DIR, name);
}

/**
 * 以文本的形式读取fixtures目录下的一个文件。
 *
 * @param name 文件名
 * @return 文件的文本内容
 */
export function readFixtureText(name: string) {
	return readFileSync(resolveFixture(name), { encoding: "utf8" });
}

/**
 * 返回一个Promise，在指定的时间后完成，可用于模拟耗时的操作，或搭配FakeTimers实现异步等待。
 *
 * @param time 时间，毫秒
 * @return 在指定的时间后完成的 Promise
 */
export function sleep(time = 0) {
	return new Promise<void>(resolve => setTimeout(resolve, time));
}
