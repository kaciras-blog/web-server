import { OutputAsset } from "rollup";
import { Plugin } from "vite";

const linkRE = /<link rel="stylesheet" href="([^"]+)">/g;

/**
 * 另一种复杂的实现方案，控制浏览器访问页面，记录加载的样式表：
 * https://github.com/nystudio107/rollup-plugin-critical
 */
export default function inlineGlobalCSS(page = "index.html"): Plugin {
	return {
		name: "kaciras:inline-global-css",
		enforce: "post",

		apply(config, env) {
			return !config.build?.ssr && env.mode === "production";
		},

		async generateBundle(_, bundle) {
			const html = bundle[page] as OutputAsset;
			html.source = html.source
				.toString()
				.replaceAll(linkRE, (s, u) => {
					const css = bundle[u.slice(1)] as OutputAsset;
					return css ? `<style>${css.source}</style>` : s;
				});
		},
	};
}
