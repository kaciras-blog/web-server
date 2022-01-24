import { cwd } from "process";
import path from "path";
import { ConfigEnv, defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import compress from "vite-plugin-compression";
import { ResolvedDevConfig } from "./options.js";
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

// function defaultDict<T>(value: T, origin: Record<string | symbol, T> = {}) {
// 	return new Proxy(origin, {
// 		get: (target, key) => key in target ? target[key] : value,
// 	});
// }

function createConfig(options: ResolvedDevConfig, env: ConfigEnv) {
	const isProd = env.mode === "production";

	return {
		resolve: {
			alias: {
				"@": resolve("src"),
			},
		},
		plugins: [
			vue({
				// compiler: {
				// 	compilerOptions: {
				// 		directiveTransforms: defaultDict({ props: [] }),
				// 	},
				// },
			}),
			vueSvgComponent(),

			isProd && compress({
				filter: /\.(js|css|html|svg)$/,
			}),
			isProd && compress({
				filter: /\.(js|css|html|svg)$/,
				algorithm: "brotliCompress",
			}),
			isProd && optimizeImage(new RegExp("static/")),
		],
	};
}

export default function getViteConfig(options: ResolvedDevConfig) {
	return defineConfig(env => createConfig(options, env));
}
