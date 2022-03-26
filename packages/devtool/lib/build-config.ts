import { cwd } from "process";
import { join } from "path";
import { UserConfig } from "vite";
import visualizer from "rollup-plugin-visualizer";
import inspect from "vite-plugin-inspect";
import vue from "@vitejs/plugin-vue";
import vueSvgSfc from "vite-plugin-svg-sfc";
import { ResolvedDevConfig } from "./options.js";
import compressAssets from "./plugin/compress-assets.js";
import SWPlugin from "./plugin/service-worker.js";
import optimizeImage from "./plugin/optimize-image.js";

/**
 * 创建 Vite 的配置。由于架构不同，仅需一个函数，比以前三个 getWebpackConfig 简单多了。
 *
 * 因为 ConfigEnv 没有 SSR 信息，所以没用 UserConfigFn 而是传一个参数来区分。
 */
export default function getViteConfig(options: ResolvedDevConfig, isSSR: boolean) {
	const { backend, build, ssr } = options;
	const {
		mode, env = {}, debug, sourcemap,
		bundleAnalyzer, serviceWorker, vueOptions,
	} = build;

	let { outputDir } = options;
	if (ssr) {
		outputDir = join(outputDir, isSSR ? "server" : "client");
	}

	env.API_PUBLIC = backend.public;
	env.API_INTERNAL = backend.internal;

	/*
	 * Webpack 等旧一代工具常用 `typeof window` 来判断环境，至今仍有许多库使用这种方法，
	 * 但 Vite 这样以 ESM 为基准的默认不内联它们，所以手动兼容一下，以便 Tree Shaking。
	 */
	const define: Record<string, unknown> = {
		"typeof window": isSSR ? "'undefined'" : "'object'",
	};
	for (const [k, v] of Object.entries(env)) {
		define["import.meta.env." + k] = JSON.stringify(v);
	}

	return <UserConfig>{
		resolve: {
			alias: [{
				find: new RegExp("^@/"),
				replacement: join(cwd(), "src") + "/",
			}],
		},
		define,
		mode,
		build: {
			assetsDir: options.assetsDir,
			target: build.target,

			ssr: isSSR && ssr,
			ssrManifest: isSSR,
			outDir: outputDir,

			sourcemap,

			// 图片体积大很正常，所以放宽点。
			chunkSizeWarningLimit: 2048,

			// 关闭压缩测试增加性能，因为另有插件做压缩。
			reportCompressedSize: false,

			// 本项目已经全线转 ESM，不再兼容 CJS。
			rollupOptions: {
				output: { format: "esm" },
			},
		},
		plugins: [
			bundleAnalyzer && visualizer(),
			debug && inspect(),

			vueSvgSfc(),
			vue(vueOptions),

			serviceWorker && SWPlugin(serviceWorker),

			optimizeImage(new RegExp("static/")),
			compressAssets({ algorithm: "gz" }),
			compressAssets({ algorithm: "br" }),
		],
	};
}
