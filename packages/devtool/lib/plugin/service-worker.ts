import { join } from "path";
import { OutputOptions, rollup } from "rollup";
import { Plugin, ResolvedConfig } from "vite";

const manifestRE = /self\.__WB_MANIFEST/;

function replaceCode(src: string, manifest: string): Plugin {
	let swId: string;

	return {
		name: "kaciras:sw-inject-manifest",
		async transform(code, id) {
			if (swId === undefined) {
				swId = (await this.resolve(src))!.id;
			}
			if (id !== swId) {
				return null;
			}
			return code.replace(manifestRE, manifest);
		},
	};
}

const includedPlugins = [
	"commonjs",
	"alias",
	"vite:resolve",
	"vite:esbuild",
	"vite:json",
	"replace",
	"vite:define",
	"rollup-plugin-dynamic-import-variables",
	"vite:terser",
	"vite:esbuild-transpile",
];

type FilterFn = (name: string) => boolean;

export interface ServiceWorkerOptions {
	src: string;
	dist?: string;
	includes?: RegExp | FilterFn;
}

/**
 * 构建 ServiceWorker 的插件，能够生成额外的 SW 入口文件。
 * 支持开发模式，但由于 worker 不是简单的 import，所以无法热重载。
 *
 * <h2>为什么造轮子</h2>
 * 以下项目均使用 workbox-build：
 * https://github.com/antfu/vite-plugin-pwa
 * https://github.com/modernweb-dev/web
 *
 * 装个 workbox-build 一下子就整上十万甚至九万个依赖，看着就烦。
 * workbox 源码我都看几遍了，自己实现一个也不难。
 *
 * @param options 插件选项
 */
export default function SWPlugin(options: ServiceWorkerOptions): Plugin {
	const { src, dist = "/sw.js", includes = () => true } = options;

	const isInclude = typeof includes === "function"
		? includes
		: (name: string) => includes.test(name);

	let viteConfig: ResolvedConfig;

	function swBuildConfig(manifest: string) {
		const plugins = viteConfig.plugins
			.filter(p => includedPlugins.includes(p.name));
		plugins.push(replaceCode(src, manifest));

		return { input: src, plugins };
	}

	async function buildSW(manifest: string) {
		const { outDir, sourcemap } = viteConfig.build;

		const config = swBuildConfig(manifest);
		const bundle = await rollup(config);

		const output: OutputOptions = {
			file: join(outDir, dist),
			format: "es",
			exports: "none",
			sourcemap,
			inlineDynamicImports: true,
		};

		return bundle.write(output)
			.then(w => w.output[0])
			.finally(() => bundle.close());
	}

	return {
		name: "kaciras:service-worker",
		apply: config => !config.build?.ssr,

		configResolved(config) {
			viteConfig = config;
		},

		async load(id) {
			if (!id.endsWith(src)) {
				return null;
			}
			const { fileName } = await buildSW("[]");
			return `export default "${fileName}"`;
		},

		async generateBundle(_, bundle) {
			const files = Object.keys(bundle).filter(isInclude);

			// 一律格式化，反正生产模式还会压缩的。
			await buildSW(JSON.stringify(files, null, "\t"));
		},
	};
}
