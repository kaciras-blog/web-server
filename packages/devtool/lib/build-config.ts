import { cwd } from "process";
import path from "path";
import { defineConfig } from "vite";
import visualizer from "rollup-plugin-visualizer";
import vue from "@vitejs/plugin-vue";
import { ResolvedDevConfig } from "./options.js";
import compressAssets from "./plugin/compress-assets.js";
import vueSvgComponent from "./plugin/vue-svg-component.js";
import optimizeImage from "./plugin/optimize-image.js";

/**
 * 将相对于 process.cwd 的路径转换为绝对路径。
 *
 * @param relativePath 相对路径
 * @return 对应的绝对路径
 */
export function resolve(relativePath: string) {
	return path.join(cwd(), relativePath);
}

export default function getViteConfig(options: ResolvedDevConfig) {
	const isProd = options.build.mode === "production";

	return defineConfig({
		resolve: {
			alias: [
				{
					find: new RegExp("@/"),
					replacement: resolve("src") + "/",
				},
				{
					find: new RegExp("@assets/"),
					replacement: resolve("src/assets") + "/",
				},
			],
		},
		define: {
			"process.env.API_ORIGIN": JSON.stringify(options.contentServer.publicOrigin),
			"process.env.SSR_API_ORIGIN": JSON.stringify(options.contentServer.internalOrigin),
		},
		build: {
			assetsDir: options.assetsDir,
		},
		plugins: [
			vue(options.build.vueOptions),

			vueSvgComponent(),

			options.build.bundleAnalyzer && visualizer(),

			compressAssets({ algorithm: "gz" }),
			compressAssets({ algorithm: "br" }),

			optimizeImage(new RegExp("static/")),
		],
	});
}
