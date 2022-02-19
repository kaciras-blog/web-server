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
	const { backend, build } = options;
	const { env = {}, debug, bundleAnalyzer, serviceWorker, vueOptions } = build;

	env.API_PUBLIC = backend.public;
	env.API_INTERNAL = backend.internal;

	const define: Record<string, any> = {};
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
		build: {
			assetsDir: options.assetsDir,
			target: build.target,

			ssr: isSSR && "src/entry-server.ts",
			ssrManifest: isSSR,
			outDir: isSSR ? "dist/server" : "dist/client",

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
			inspect({ enabled: debug }),
			bundleAnalyzer && visualizer(),

			vueSvgSfc(),
			vue(vueOptions),

			serviceWorker && SWPlugin(serviceWorker),

			optimizeImage(new RegExp("static/")),
			compressAssets({ algorithm: "gz" }),
			compressAssets({ algorithm: "br" }),
		],
	};
}
