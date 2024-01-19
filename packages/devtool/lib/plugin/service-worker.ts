import { join } from "path";
import { OutputOptions, rollup } from "rollup";
import { Plugin, ResolvedConfig } from "vite";
import replace from "@rollup/plugin-replace";

const includedVitePlugins = [
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
	includes?: RegExp | FilterFn;
	dist?: string;
	plugins?: Array<string | Plugin>;
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
	const { src, dist = "/sw.js", includes = () => true, plugins = [] } = options;

	const isInclude = typeof includes === "function"
		? includes
		: (name: string) => includes.test(name);

	let viteConfig: ResolvedConfig;

	/**
	 * 生成专门用于构建 ServiceWorker 的 rollup 配置，主要是选择插件。
	 *
	 * @param files 需要缓存的静态资源列表
	 */
	function swBuildConfig(files: string[]) {
		const names = [
			...includedVitePlugins,
			...plugins.filter(i => typeof i === "string"),
		];

		// 一律格式化，反正生产模式还会压缩的；另外 Rollup 有并发编译的过程，
		// 故 bundle 中键的顺序不确定，所以排个序避免意外的 Hash 变动。
		const manifest = JSON.stringify(files.sort(), null, "\t");

		const used: Plugin[] = [
			replace({ "self.__WB_MANIFEST": manifest }),
			...viteConfig.plugins.filter(p => names.includes(p.name)),
			...plugins.filter(i => typeof i !== "string") as Plugin[],
		];

		return { input: src, plugins: used };
	}

	/*
	 * 暂不支持开发模式，因为 Vite 基于 ESM 而 ServiceWorker 的支持还不行。
	 *
	 * <h2>插件顺序</h2>
	 * 因为资源升级采用了后端选择，无需把优化版本加入列表，所以不用放在最后。
	 */
	return {
		name: "kaciras:service-worker",
		apply: config => !config.build?.ssr,

		configResolved(config) {
			viteConfig = config;
		},

		async generateBundle(_, bundle) {
			const files = Object.keys(bundle).filter(isInclude);
			const { outDir, sourcemap } = viteConfig.build;

			const swBundle = await rollup(swBuildConfig(files));

			const output: OutputOptions = {
				file: join(outDir, dist),
				format: "es",
				exports: "none",
				sourcemap,
				inlineDynamicImports: true,
			};

			await swBundle.write(output)
				.then(w => w.output[0])
				.finally(() => swBundle.close());
		},
	};
}
