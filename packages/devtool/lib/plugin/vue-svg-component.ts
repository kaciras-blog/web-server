import { readFileSync } from "fs";
import { Plugin as VitePlugin } from "vite";
import { optimize, Plugin } from "svgo";

/**
 * 调整 SVG 的属性，使其能够用容器元素的 CSS 控制：
 * 1）宽高设为 1em 以便外层用 font-size 控制。
 * 2）将 fill 和 stroke 改为 currentColor 以便用 color 控制。
 *
 * 代码从另一个项目复制的：
 * https://github.com/Kaciras/browser-theme/blob/master/rollup/svg.js
 */
const reactiveSvgoPlugin: Plugin = {
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
 * 移除并收集所有 <style> 元素的 SVGO 插件。
 *
 * 实现参考了：
 * https://github.com/svg/svgo/blob/main/plugins/mergeStyles.js
 *
 * @param styles 样式元素的内容将添加到这里
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
	reactiveSvgoPlugin,
	{ name: "removeDoctype" },
	{ name: "removeXMLProcInst" },
];

const productionPlugins: Plugin[] = [
	reactiveSvgoPlugin,
	minifyPreset, // 它会把 #000000 改为 none 导致 reactiveSvgoPlugin 失效，要放到最后。
];

/**
 * 将 SVG 转换为 Vue 的 SFC，需要配合 @vitejs/plugin-vue 使用。
 *
 * <h2>SVG 组件的 import</h2>
 * vite-svg-loader 和 @vuetter/vite-plugin-vue-svg 均采用额外参数来与默认的加载方式区分。
 * 这样的好处是保持与其它资源一致，而且 TS 类型也好匹配。
 *
 * <h2>关于全局副作用元素</h2>
 * - 内联样式会提取到 SFC 的 <style scoped> 中，避免污染全局。
 * - 本加载器不处理 <script>，因为其无法简单地转为 SFC 中对应的部分，
 *   另外 @vue/compiler-sfc 在 <template> 里遇到 <script> 会报错。
 *
 * 这种情况并不常见，因为以内联为目的的 SVG 通常会避免副作用。
 */
export default function vueSvgComponent(): VitePlugin {
	let minify: boolean;

	return {
		name: "kaciras:vue-svg-component",
		enforce: "pre",

		configResolved(config) {
			config.optimizeDeps.exclude?.push("**/*.svg.vue");
			minify = config.mode === "production";
		},

		/**
		 * 把需要内联的 SVG 的文件名解析成了 .svg.vue 文件，
		 * 这样无需修改 vue 插件的 includes。
		 *
		 * Vite 的 importAnalysis 插件在启用热重载时会将 ID 去掉 root 后再解析一次，
		 * 所以此处要接受 .svg?sfc 和 .svg.vue 两者。
		 */
		async resolveId(id: string, importer: string) {
			if (!/\.svg(?:\?sfc|\.vue)$/.test(id)) {
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
			const styles: string[] = [];

			const plugins = [
				...(minify ? productionPlugins : developmentPlugins),
				collectStyles(styles),
			];

			const svg = readFileSync(id.slice(0, -4), "utf8");
			const result = optimize(svg, { plugins });

			if (result.modernError) {
				throw result.modernError;
			}

			const code = `<template>${result.data}</template>`;
			if (styles.length === 0) {
				return code;
			} else {
				const cssContent = styles.join("");
				return `${code}<style scoped>${cssContent}</style>`;
			}
		},
	};
}
