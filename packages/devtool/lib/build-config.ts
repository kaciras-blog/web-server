import { cwd } from "process";
import { join } from "path";
import { defineConfig } from "vite";
import visualizer from "rollup-plugin-visualizer";
import Inspect from "vite-plugin-inspect";
import vue from "@vitejs/plugin-vue";
import { ResolvedDevConfig } from "./options.js";
import compressAssets from "./plugin/compress-assets.js";
import SWPlugin from "./plugin/service-worker.js";
import vueSvgComponent from "./plugin/vue-svg-component.js";
import optimizeImage from "./plugin/optimize-image.js";

export default function getViteConfig(options: ResolvedDevConfig) {
	const { backend, build } = options;
	const { env = {}, debug, bundleAnalyzer, serviceWorker, vueOptions } = build;

	env.API_PUBLIC = backend.public;
	env.API_INTERNAL = backend.internal;

	const define: Record<string, any> = {};
	for (const [k, v] of Object.entries(env)) {
		define["import.meta.env." + k] = JSON.stringify(v);
	}

	return defineConfig({
		resolve: {
			alias: [{
				find: new RegExp("^@/"),
				replacement: join(cwd(), "src") + "/",
			}],
		},
		define,
		build: {
			assetsDir: options.assetsDir,
		},
		plugins: [
			Inspect({ enabled: debug }),

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
