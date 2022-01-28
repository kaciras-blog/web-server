import { cwd } from "process";
import { join } from "path";
import { defineConfig } from "vite";
import visualizer from "rollup-plugin-visualizer";
import vue from "@vitejs/plugin-vue";
import { ResolvedDevConfig } from "./options.js";
import compressAssets from "./plugin/compress-assets.js";
import SWPlugin from "./plugin/service-worker.js";
import vueSvgComponent from "./plugin/vue-svg-component.js";
import optimizeImage from "./plugin/optimize-image.js";

export default function getViteConfig(options: ResolvedDevConfig) {
	const { bundleAnalyzer, serviceWorker, vueOptions } = options.build;

	return defineConfig({
		resolve: {
			alias: [{
				find: new RegExp("^@/"),
				replacement: join(cwd(), "src") + "/",
			}],
		},
		define: {
			"process.env.API_ORIGIN": JSON.stringify(options.backend.public),
			"process.env.SSR_API_ORIGIN": JSON.stringify(options.backend.internal),
		},
		build: {
			assetsDir: options.assetsDir,
		},
		plugins: [
			vueSvgComponent(),
			vue(vueOptions),

			serviceWorker && SWPlugin(serviceWorker),

			bundleAnalyzer && visualizer(),

			optimizeImage(new RegExp("static/")),
			compressAssets({ algorithm: "gz" }),
			compressAssets({ algorithm: "br" }),
		],
	});
}
