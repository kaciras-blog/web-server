import { LoaderContext } from "webpack";
import { CustomPlugin, extendDefaultPlugins, optimize } from "svgo";

/**
 * 调整 SVG 的属性，使其能够用容器元素的 CSS 控制：
 * 1）宽高设为 1em 以便外层用 font-size 控制。
 * 2）将 fill 和 stroke 改为 currentColor 以便用 color 控制。
 *
 * 代码从另一个项目复制的：
 * https://github.com/Kaciras/browser-theme/blob/master/rollup/svg.js
 */
const reactiveRootAttributePlugin: CustomPlugin = {
	name: "reactiveSVGAttribute",
	type: "perItem",
	fn(ast) {
		const { type, name, attributes } = ast;
		const { fill, stroke } = attributes;

		if (type === "element" && name === "svg") {
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

const svgoConfig = {
	plugins: [
		...extendDefaultPlugins([
			{ name: "removeViewBox", active: false },
		]),
		reactiveRootAttributePlugin,
	],
};

/**
 * SVG 组件的加载器，优化 SVG 并将宽高、颜色等属性设为能够响应的值，
 * 然后在 SVG 外层加上 <template> 包裹。
 *
 * 本加载器需要配合 vue-loader 使用。
 *
 * @param svg SVG 内容
 * @see https://github.com/visualfanatic/vue-svg-loader/blob/dev/index.js
 */
export default function (this: LoaderContext<void>, svg: string) {
	const { data } = optimize(svg, {
		...svgoConfig,
		path: this.resourcePath,
	});
	return `<template>${data}</template>`;
}
