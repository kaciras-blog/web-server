import { readFileSync } from "fs";
import { join } from "path";
import { OutputBundle, OutputOptions, rollup, RollupWatcher, RollupWatchOptions, watch } from "rollup";
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
		let swId: string;

		const injectManifestPlugin: Plugin = {
			name: "kaciras:sw-inject-manifest",
			async load(id) {
				if (swId === undefined) {
					swId = (await this.resolve(src))!.id;
				}
				if (id !== swId) {
					/*
					 * Vite 内部也是直接把查询参数去掉。
					 * https://github.com/vitejs/vite/blob/5306234aad7e7432fb55c6033a63c6cf74493c3f/packages/vite/src/node/server/transformRequest.ts#L87
					 */
					const file = id.split("?", 2)[0];
					return readFileSync(file, "utf8");
				}
				const code = readFileSync(id, "utf8");
				return code.replace(manifestRE, manifest);
			},
		};

		const plugins = viteConfig.plugins
			.filter(p => includedPlugins.includes(p.name));
		plugins.push(injectManifestPlugin);

		return { input: src, plugins };
	}

	async function buildServiceWorker(manifest: string) {
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
		await bundle.write(output).finally(() => bundle.close());
	}

	let watcher: RollupWatcher;

	return {
		name: "kaciras:service-worker",
		apply: config => !config.build?.ssr,

		configResolved(config) {
			viteConfig = config;
		},

		configureServer(server) {
			const config = swBuildConfig("[]") as RollupWatchOptions;
			config.watch = { skipWrite: true };
			watcher = watch(config);

			let code: string;

			watcher.on("event", async event => {
				if (event.code === "ERROR") {
					console.error(event.error);
				}
				if (event.code === "BUNDLE_END") {
					const s = await event.result.generate({
						format: "es",
						exports: "none",
						inlineDynamicImports: true,
					});
					code = s.output[0].code;
				}
			});

			server.middlewares.use((req, res, next) => {
				if (req.url !== dist) {
					return next();
				}
				res.writeHead(200).end(code);
			});
		},

		buildEnd() {
			watcher?.close();
		},

		generateBundle(_: unknown, bundle: OutputBundle) {
			const files = Object.keys(bundle).filter(isInclude);

			// 一律格式化，反正生产模式还会压缩的。
			const manifest = JSON.stringify(files, null, "\t");
			return buildServiceWorker(manifest);
		},
	};
}
