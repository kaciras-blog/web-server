import { Plugin as VitePlugin } from "vite";
import { optimize, Plugin } from "svgo";
import { readFileSync } from "fs-extra";

/**
 * 调整 SVG 的属性，使其能够用容器元素的 CSS 控制：
 * 1）宽高设为 1em 以便外层用 font-size 控制。
 * 2）将 fill 和 stroke 改为 currentColor 以便用 color 控制。
 *
 * 代码从另一个项目复制的：
 * https://github.com/Kaciras/browser-theme/blob/master/rollup/svg.js
 */
const reactivePlugin: Plugin = {
	name: "reactiveSVGAttribute",
	type: "perItem",
	fn(ast) {
		const { type, name, attributes } = ast;

		if (type === "element" && name === "svg") {
			const { fill, stroke } = attributes;

			if (stroke && stroke !== "none") {
				attributes.stroke = "currentColor";
			}
			if (fill && fill !== "none") {
				attributes.fill = "currentColor";
			}
			attributes.width = attributes.height = "1em";
		}
	},
};

/**
 *
 * 参考：
 * https://github.com/svg/svgo/blob/main/plugins/mergeStyles.js
 *
 * @param styles
 */
function collectStyles(styles: string[]): any {

	function enter(node: any, parent: any) {
		if (node.name !== "style") {
			return;
		}
		for (const child of node.children) {
			styles.push(child.value);
		}
		parent.children = parent.children
			.filter((c: unknown) => c !== node);
	}

	return {
		name: "collectStyles",
		type: "visitor",
		fn: () => ({ element: { enter } }),
	};
}

export const minifyPreset: Plugin = {
	name: "preset-default",
	params: {
		overrides: {
			removeViewBox: false,
		},
	},
};

const developmentPlugins: Plugin[] = [
	reactivePlugin,
	{ name: "removeDoctype" },
	{ name: "removeXMLProcInst" },
];

const productionPlugins: Plugin[] = [
	reactivePlugin,
	minifyPreset, // 它会把 #000000 改为 none 导致 reactivePlugin 失效，要放到最后。
];

/**
 * 将 HTML 内容转换为 Vue 的 SFC，本加载器需要配合 vue-loader 使用。
 *
 * <h2>关于全局副作用元素</h2>
 * - 内联样式会提取到 SFC 的 <style scoped> 中，避免污染全局。
 * - 本加载器不处理 <script>，因为其无法简单地转为 SFC 中对应的部分，
 *   另外 vue-loader 在 <template> 里遇到 <script> 会报错。
 *
 * 这种情况并不常见，因为以内联为目的的 SVG 通常会避免副作用。
 *
 * @see https://github.com/visualfanatic/vue-svg-loader/blob/dev/index.js
 */
export default function vueSvgComponent(): VitePlugin {
	let minify: boolean;

	// function hash(path: string, code: string) {
	// 	const hash = createHash("sha256");
	// 	hash.update(path);
	// 	if (minify) {
	// 		hash.update(code);
	// 	}
	// 	return hash.digest("base64url").slice(0, 8);
	// }

	return {
		name: "kaciras:vue-svg-component",
		enforce: "pre",

		configResolved(config) {
			minify = config.mode === "production";
		},

		async resolveId(id: string, importer: string) {
			if (!id.endsWith(".svg?sfc")) {
				return null;
			}
			id = id.slice(0, -4);
			const r = await this.resolve(id, importer, { skipSelf: true });
			if (r) {
				return r.id + ".vue";
			}
			throw new Error("Cannot resolve file: " + id);
		},

		load(id: string) {
			if (!id.endsWith(".svg.vue")) {
				return null;
			}
			let plugins = minify ? productionPlugins : developmentPlugins;

			const styles: string[] = [];
			plugins = [...plugins, collectStyles(styles)];

			const path = id.slice(0, -4);
			const svg = readFileSync(path, "utf8");
			const result = optimize(svg, { plugins });

			if (result.modernError) {
				throw result.modernError;
			}

			const code = `<template>${result.data}</template>`;
			if (styles.length === 0) {
				return code;
			} else {
				const style = styles.join("");
				return `${code}<style scoped>${style}</style>`;
			}
		},
	};
}
