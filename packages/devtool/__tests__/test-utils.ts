import { join } from "path";
import { mkdirSync, mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { InputOptions, RollupOutput } from "rollup";
import { build, InlineConfig, mergeConfig, Plugin } from "vite";
import { afterEach, beforeEach, expect } from "vitest";

const TE_ID = resolveFixture("_TEST_ENTRY_.js");

export function testEntry(code: string, name = TE_ID): Plugin {
	return {
		name: "test-entry",
		options(options: InputOptions) {
			return { ...options, input: name };
		},
		resolveId(source: string) {
			return source === name ? source : null;
		},
		load(id: string) {
			if (id !== name) {
				return null;
			}
			return { code, moduleSideEffects: "no-treeshake" };
		},
	};
}

const baseConfig: InlineConfig = {
	logLevel: "silent",
	build: {
		assetsInlineLimit: 0,
		write: false,
		rollupOptions: {
			onwarn: () => {},
			output: {
				entryFileNames: "[name].js",
				chunkFileNames: "[name].js",
				assetFileNames: "[name].[ext]",
			},
		},
	},
};

function autoResolve(object: any, key: string) {
	if (object && typeof object[key] === "string") {
		object[key] = resolveFixture(object[key]);
	}
}

export function runVite(config: InlineConfig) {
// Vite 自带了 mergeConfig 函数，也是递归合并对象，而且增加了对某些属性的特殊处理。
	config = mergeConfig(baseConfig, config);

	autoResolve(config.build?.rollupOptions, "input");
	autoResolve(config.build, "ssr");

	return build(config) as Promise<RollupOutput>;
}

export function viteWrite(outDir: string, config: InlineConfig) {
	return runVite(mergeConfig(config, { build: { outDir, write: true } }));
}

/**
 * 从构建的结果中读取 Asset 的内容，如果没找到或不是 Asset 则失败。
 *
 * @param bundle 构建结果
 * @param name Asset 的文件名
 * @return Asset 的内容
 */
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
 * 返回 fixtures 目录下文件的完整路径。
 *
 * @param name 文件名
 * @return 完整路径
 */
export function resolveFixture(name: string) {
	return join(import.meta.dirname, "fixtures", name);
}

export function useTempDirectory() {
	const root = mkdtempSync(join(tmpdir(), "vitest-"));
	beforeEach(() => void mkdirSync(root, { recursive: true }));
	afterEach(() => rmSync(root, { recursive: true }));
	return root;
}
