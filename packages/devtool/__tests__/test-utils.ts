import { join } from "path";
import { RollupOutput } from "rollup";
import { build, InlineConfig, Plugin } from "vite";
import { expect } from "vitest";

const TE_ID = resolveFixture("_TEST_ENTRY_.js");

export function testEntry(code: string): Plugin {
	return {
		name: "test-entry",
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

export function runVite(config: InlineConfig, entry = TE_ID) {
	const base: InlineConfig = {
		logLevel: "error",
		build: {
			rollupOptions: {
				input: entry,
				output: {
					entryFileNames: "[name].js",
					chunkFileNames: "[name].js",
					assetFileNames: "[name].[ext]",
				},
			},
			write: false,
		},
	};
	return build({ ...base, ...config }) as Promise<RollupOutput>;
}

export function getAsset(bundle: RollupOutput, name: string) {
	name = name.split("?", 2)[0];
	const file = bundle.output.find(a => a.fileName === name);

	if (!file) {
		return expect.fail(`${name} is not in the bundle`);
	}
	if (file.type === "asset") {
		return file.source;
	}
	return expect.fail(`${name} is exists but not an asset`);
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
