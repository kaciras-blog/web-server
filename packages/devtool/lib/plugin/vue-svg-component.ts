import { readFileSync } from "fs";
import { Plugin as VitePlugin } from "vite";
import { optimize, Plugin } from "svgo";

/**
 * 调整 SVG 的属性，使其能够用容器元素的 CSS 控制：
 * 1）宽高设为 1em 以便外层用 font-size 控制。
 * 2）将 fill 和 stroke 改为 currentColor 以便上层控制。
 *
 * 该插件比 CSS （如 svg { fill: currentColor; ... }）更精确，
 * 因为有些图标用 fill，有些用的是 stroke。
 *
 * 代码从另一个项目复制的：
 * https://github.com/Kaciras/browser-theme/blob/master/rollup/svg.js
 */
const reactiveColorPlugin: Plugin = {
	name: "reactiveSVGAttribute",
	type: "perItem",
	fn(ast) {
		const { type, name, attributes } = ast;

		if (type === "element" && name === "svg") {
			const { fill, stroke } = attributes;

			if (stroke && stroke !== "none") {
				attributes.stroke = "currentColor";
			}
			if (fill !== "none") {
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
function extractStyles(styles: string[]): any {

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

// 需要保证单根，否则无法设置属性。
const developmentPlugins: Plugin[] = [
	reactiveColorPlugin,
	{ name: "removeComments" },
	{ name: "removeDoctype" },
	{ name: "removeXMLProcInst" },
];

const productionPlugins: Plugin[] = [
	reactiveColorPlugin,
	minifyPreset, // 它会把 #000000 改为 none 导致 reactiveColorPlugin 失效，要放到最后。
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

		// 本插件必须在 vite:asset 以及其它处理 .vue 文件的插件之前执行。
		enforce: "pre",

		configResolved(config) {
			minify = config.mode === "production";
		},

		/**
		 * 解析原始的 SVG 文件路径，同时附加 .vue?sfc 后缀。
		 *
		 * <h3>后缀的用途</h2>
		 * .vue 扩展名让 vue 插件无需修改 includes 就能处理它；
		 * 最后的 ?sfc 可以避免被 vite:scan-deps 预处理。
		 *
		 * <h2>接受的 ID</h2>
		 * Vite 的 importAnalysis 插件在热重载时会将 ID 去掉 root 后再解析一次，
		 * 所以此处要接受 .svg?sfc 和 .svg.vue?sfc 两者。
		 */
		async resolveId(id: string, importer: string) {
			const match = /\.svg(?:\.vue)?\?sfc$/.exec(id);
			if (!match) {
				return null;
			}
			id = id.slice(0, match.index + 4);
			const r = await this.resolve(id, importer, { skipSelf: true });
			if (r) {
				return r.id + ".vue?sfc";
			}
			throw new Error("Cannot resolve file: " + id);
		},

		load(id: string) {
			if (!id.endsWith(".svg.vue?sfc")) {
				return null;
			}
			return readFileSync(id.slice(0, -8), "utf8");
		},

		/**
		 * 其实在 load 阶段就可以处理 SVG 到 Vue SFC 的转换，
		 * 但 addWatchFile 不在 transform 里调用监视就不生效，不知道怎么回事……
		 */
		transform(code, id) {
			if (!id.endsWith(".svg.vue?sfc")) {
				return null;
			}
			this.addWatchFile(id.slice(0, -8));

			const styles: string[] = [];
			const plugins = [
				...(minify ? productionPlugins : developmentPlugins),
				extractStyles(styles),
			];

			const result = optimize(code, { plugins });
			if (result.modernError) {
				throw result.modernError;
			}

			code = `<template>${result.data}</template>`;
			if (styles.length === 0) {
				return code;
			} else {
				const css = styles.join("");
				return `${code}<style scoped>${css}</style>`;
			}
		},
	};
}
