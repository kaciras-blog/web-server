import { join } from "path";
import { InputOptions, RollupOutput } from "rollup";
import { build, InlineConfig, Plugin } from "vite";
import { afterEach, beforeEach, expect } from "vitest";
import deepmerge from "deepmerge";
import { mkdirSync, mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";

const TE_ID = resolveFixture("_TEST_ENTRY_.js");

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

export function avoidEmptyChunkTS(): Plugin {
	let id: string;

	return {
		name: "test:avoid-empty-chunk-warning",
		enforce: "pre",
		buildStart(options) {
			id = (options.input as string[])[0];
		},
		resolveId(source: string) {
			if (source !== id) {
				return null;
			}
			return { id, moduleSideEffects: "no-treeshake" };
		},
	};
}

const baseConfig: InlineConfig = {
	logLevel: "silent",
	build: {
		write: false,
		rollupOptions: {
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
	config = deepmerge(baseConfig, config);

	autoResolve(config.build?.rollupOptions, "input");
	autoResolve(config.build, "ssr");

	return build(config) as Promise<RollupOutput>;
}

export function viteWrite(outDir: string, config: InlineConfig) {
	return runVite(deepmerge(config, { build: { outDir, write: true } }));
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
	return join(__dirname, "fixtures", name);
}

export function useTempDirectory() {
	const root = mkdtempSync(join(tmpdir(), "vitest-"));
	beforeEach(() => void mkdirSync(root, { recursive: true }));
	afterEach(() => rmSync(root, { recursive: true }));
	return root;
}
