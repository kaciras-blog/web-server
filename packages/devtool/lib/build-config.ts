import { cwd } from "process";
import { join } from "path";
import { defineConfig } from "vite";
import visualizer from "rollup-plugin-visualizer";
import vue from "@vitejs/plugin-vue";
import { ResolvedDevConfig } from "./options.js";
import compressAssets from "./plugin/compress-assets.js";
import vueSvgComponent from "./plugin/vue-svg-component.js";
import optimizeImage from "./plugin/optimize-image.js";

export default function getViteConfig(options: ResolvedDevConfig) {
	return defineConfig({
		resolve: {
			alias: [{
				find: new RegExp("^@/"),
				replacement: join(cwd(), "src") + "/",
			}],
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
