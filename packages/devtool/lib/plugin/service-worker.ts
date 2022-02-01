import { readFileSync } from "fs";
import { join } from "path";
import { OutputBundle, OutputOptions, rollup } from "rollup";
import { Plugin, ResolvedConfig } from "vite";

const manifestRE = /self\.__WB_MANIFEST/;

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
 *
 *
 * <h2>为什么造轮子</h2>
 * 以下项目均使用 workbox-build：
 * https://github.com/antfu/vite-plugin-pwa
 * https://github.com/modernweb-dev/web
 *
 * 装个 workbox-build 一下子就整上十万甚至九万个依赖，看着就烦。
 * workbox 源码我都看几遍了，自己实现一个也不难。
 *
 * @param options
 */
export default function SWPlugin(options: ServiceWorkerOptions): Plugin {
	const { src, dist = "sw.js", includes = () => true } = options;

	const isInclude = typeof includes === "function"
		? includes
		: (name: string) => includes.test(name);

	let viteConfig: ResolvedConfig;

	async function buildServiceWorker(manifest: string) {
		const { outDir, sourcemap } = viteConfig.build;
		let swId: string;

		const injectManifestPlugin: Plugin = {
			name: "kaciras:sw-inject-manifest",
			async load(id) {
				if (swId === undefined) {
					swId = (await this.resolve(src))!.id;
				}
				if (id !== swId) {
					return null;
				}
				const code = readFileSync(id, "utf8");
				return code.replace(manifestRE, manifest);
			},
		};

		const plugins = viteConfig.plugins
			.filter(p => includedPlugins.includes(p.name));
		plugins.unshift(injectManifestPlugin);

		const bundle = await rollup({ input: src, plugins });

		const output: OutputOptions = {
			file: join(outDir, dist),
			format: "es",
			exports: "none",
			sourcemap,
			inlineDynamicImports: true,
		};
		await bundle.write(output).finally(() => bundle.close());
	}

	return {
		name: "kaciras:service-worker",
		apply: config => !config.build?.ssr,

		configResolved(config) {
			viteConfig = config;
		},

		generateBundle(_: unknown, bundle: OutputBundle) {
			const files = Object.keys(bundle).filter(isInclude);

			// 一律格式化，反正生产模式还会压缩的。
			const manifest = JSON.stringify(files, null, "\t");
			return buildServiceWorker(manifest);
		},
	};
}
