import { basename, join } from "path";
import { InlineConfig } from "vite";
import { visualizer } from "rollup-plugin-visualizer";
import tsconfigPaths from "vite-tsconfig-paths";
import inspect from "vite-plugin-inspect";
import vueSvgSfc from "vite-plugin-svg-sfc";
import vue from "@vitejs/plugin-vue";
import { ResolvedDevConfig } from "./options.js";
import compressAssets from "./plugin/compress-assets.js";
import SWPlugin from "./plugin/service-worker.js";
import optimizeImage from "./plugin/optimize-image.js";
import { ssrManifestPlugin } from "./plugin/ssr-manifest-ex.js";
import { mergeByPriority } from "./manual-chunks.js";

// 这个函数应该放到 website 项目里，但这需要重新设计架构，下一版再说。
function chunkNameAdnPriority(id: string) {
	const name = basename(id);
	const list = [
		"Console.vue",
		"EditorPage.vue",
		"MarkdownView.vue",
		"index.html",
	];
	return { name, value: list.indexOf(name) };
}

/**
 * 创建 Vite 的配置。由于架构不同，仅需一个函数，比以前三个 getWebpackConfig 简单多了。
 *
 * 因为 ConfigEnv 没有 SSR 信息，所以没用 UserConfigFn 而是传 isSSR 参数来区分。
 */
export default function (options: ResolvedDevConfig, isBuild: boolean, isSSR: boolean) {
	const { backend, build, ssr, env = {} } = options;
	const {
		mode, debug, sourcemap,
		bundleAnalyzer, serviceWorker, vueOptions,
	} = build;

	const minify = mode ? mode === "production" : isBuild;

	let { outputDir } = options;
	if (ssr) {
		outputDir = join(outputDir, isSSR ? "server" : "client");
	}

	const define: Record<string, unknown> = {};

	/*
	 * Webpack 等旧一代工具常用 `typeof window` 来判断环境，至今仍有许多库使用这种方法，
	 * 但 Vite 这样以 ESM 为基准的默认不内联它们，所以手动兼容一下，以便 Tree Shaking。
	 *
	 * 因为开发模式下客户端和 SSR 端共用一套配置，所以只能在构建模式里替换，作为优化手段。
	 */
	if (isBuild) {
		define["typeof window"] = isSSR ? "'undefined'" : "'object'";
	}

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
		},
		/*
		 * ssrLoadModule 优先选择导入 CJS，但外部模块未被处理仍使用 import 导入 ESM，
		 * 以至于 vue-router 之类双导出库被分别解析到两个不同的文件。
		 *
		 * 看了下 Vite 源码似乎不容易解决，目前只能先包含到构建里，也可以去提个 Issue。
		 */
		ssr: {
			noExternal: isBuild ? undefined : "@kaciras-blog/uikit",
		},
		build: {
			assetsDir: options.assetsDir,
			outDir: outputDir,

			target: build.target,
			sourcemap,
			minify,
			ssr: isSSR && ssr,

			rollupOptions: isSSR ? undefined : {
				output: {
					manualChunks: mergeByPriority(chunkNameAdnPriority),
				},
			},

			// 图片体积大很正常，所以放宽点。
			chunkSizeWarningLimit: 2048,

			// 关闭压缩测试增加性能，因为另有插件做压缩。
			reportCompressedSize: false,
		},
		plugins: [
			bundleAnalyzer && !isSSR && visualizer(),
			debug && inspect(),

			ssrManifestPlugin(),
			vueSvgSfc({ svgProps: attrs => delete attrs.class }),
			vue(vueOptions),

			tsconfigPaths({ loose: true, projects: ["tsconfig.json"] }),

			serviceWorker && SWPlugin(serviceWorker),

			optimizeImage(new RegExp("^static/")),
			compressAssets({ algorithm: "gz" }),
			compressAssets({ algorithm: "br" }),
		],
	};
}
