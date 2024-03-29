import { join } from "path";
import { InlineConfig } from "vite";
import { visualizer } from "rollup-plugin-visualizer";
import tsconfigPaths from "vite-tsconfig-paths";
import inspect from "vite-plugin-inspect";
import vueSvgSfc from "vite-plugin-svg-sfc";
import replace from "@rollup/plugin-replace";
import vue from "@vitejs/plugin-vue";
import autoprefixer from "autoprefixer";
import { ResolvedDevConfig } from "./options.js";
import compressAssets from "./plugin/compress-assets.js";
import SWPlugin from "./plugin/service-worker.js";
import optimizeImage from "./plugin/optimize-image.js";
import { ssrManifestPlugin } from "./plugin/ssr-manifest-ex.js";
import { mergeByPriority } from "./manual-chunks.js";

/**
 * 创建 Vite 的配置。仅需一个函数，比以前三个 getWebpackConfig 简单多了。
 *
 * 因为 ConfigEnv 没有 SSR 信息，所以没用 UserConfigFn 而是传 isSSR 参数来区分。
 */
export default function (options: ResolvedDevConfig, isBuild: boolean, isSSR: boolean) {
	const { backend, build, ssr, env = {} } = options;
	const {
		mode, debug, sourcemap, chunkPriority,
		bundleAnalyzer, serviceWorker, vueOptions,
	} = build;

	const minify = mode ? mode === "production" : isBuild;

	let { outputDir } = options;
	if (ssr) {
		outputDir = join(outputDir, isSSR ? "server" : "client");
	}

	const define: Record<string, unknown> = {};
	env.SENTRY_DSN = options.sentry.dsn;
	env.SENTRY_TUNNEL = options.sentry.tunnel;
	env.API_INTERNAL = backend.internal;
	env.API_PUBLIC = backend.public;
	for (const [k, v] of Object.entries(env)) {
		define["import.meta.env." + k] = JSON.stringify(v);
	}

	if (serviceWorker) {
		(serviceWorker.plugins ??= []).push("vite:tsconfig-paths");
	}

	return <InlineConfig>{
		define,
		mode,

		// 禁止自动加载 vite.config.js，避免插件被添加两次。
		configFile: false,

		css: {
			modules: {
				generateScopedName: minify ? "[hash:base64:5]" : undefined,
			},
			postcss: {
				plugins: [autoprefixer()],
			},
		},
		build: {
			assetsDir: options.assetsDir,
			outDir: outputDir,

			target: build.target,
			sourcemap,
			minify,
			ssr: isSSR && ssr,

			rollupOptions: isSSR || !chunkPriority ? undefined : {
				output: {
					manualChunks: mergeByPriority(chunkPriority),
				},
			},

			// 不需要每次都提醒，构建大小应该在优化期处理。
			chunkSizeWarningLimit: Infinity,

			// 关闭压缩测试增加性能，因为另有插件做压缩。
			reportCompressedSize: false,
		},
		plugins: [
			bundleAnalyzer && !isSSR && visualizer(),
			debug && inspect(),

			ssrManifestPlugin(),
			vueSvgSfc({ svgProps: attrs => delete attrs.class }),
			vue(vueOptions),

			/*
			 * Webpack 等旧一代工具常用 `typeof window` 来判断环境，至今仍有许多库使用这种方法，
			 * 但 Vite 默认不内联它们，所以手动兼容一下，以便 Tree Shaking。
			 *
			 * 因为开发模式下客户端和 SSR 端共用一套配置，所以只能在构建模式里替换，作为优化手段。
			 *
			 * 【注意】此处假定 typeof 后面的一定是全局对象，应该不会有人用它们当变量名吧。
			 */
			isBuild && replace({
				"typeof window": isSSR ? "'undefined'" : "'object'",
				"typeof document": isSSR ? "'undefined'" : "'object'",
				"typeof process": isSSR ? "'object'" : "'undefined'",
			}),

			tsconfigPaths({ loose: true, projects: ["tsconfig.json"] }),

			serviceWorker && SWPlugin(serviceWorker),

			optimizeImage(new RegExp("^static/")),
			compressAssets({ algorithm: "gz" }),
			compressAssets({ algorithm: "br" }),
		],
	};
}
