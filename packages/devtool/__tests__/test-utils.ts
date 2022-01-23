import { join } from "path";
import { InputOptions } from "rollup";
import { Plugin } from "vite";

const TE_ID = resolveFixture("_TEST_ENTRY_");

export function testEntry(code: string): Plugin {
	return {
		name: "test-entry",
		options(options: InputOptions) {
			return { ...options, input: TE_ID };
		},
		resolveId(source: string) {
			return source === TE_ID ? source : null;
		},
		load(id: string) {
			if (id !== TE_ID) {
				return null;
			}
			return { code, moduleSideEffects: "no-treeshake" };
		},
	};
}

/**
 * 返回fixtures目录下文件的完整路径。
 *
 * @param name 文件名
 * @return 完整路径
 */
export function resolveFixture(name: string) {
	return join(__dirname, "fixtures", name);
}
