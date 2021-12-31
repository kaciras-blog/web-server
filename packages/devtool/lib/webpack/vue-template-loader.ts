/**
 * 将 HTML 内容转换为 Vue 的 SFC，本加载器需要配合 vue-loader 使用。
 *
 * <h2>关于全局副作用元素</h2>
 * - 内联样式会提取到 SFC 的 <style scoped> 中，避免污染全局。
 * - 本加载器不处理 <script>，因为其无法简单地转为 SFC 中对应的部分，
 *   另外 vue-loader 在 <template> 里遇到 <script> 会报错。
 *
 * 这种情况并不常见，因为以内联为目的的 SVG 通常会避免副作用元素。
 *
 * @see https://github.com/visualfanatic/vue-svg-loader/blob/dev/index.js
 */
export default function (html: string) {
	const styleRE = /<style[^>]*>([\s\S]*?)<\/style>/ig;

	/*
	 * 使用正则提取出所有的样式内容，合并起来加入组件的 style。
	 * 代码抄自：
	 * https://github.com/visualfanatic/vue-svg-loader/pull/176
	 *
	 * 【其它方案】
	 * 如果不将 react-svg-loader 分离的话可以通过 SVGO 插件来做。
	 */
	let styles = "";
	let match;
	while ((match = styleRE.exec(html))) {
		const { index } = match;
		const { length } = match[0];

		styles += match[1];

		const to = index + length;
		html = html.slice(0, index) + html.slice(to);
		styleRE.lastIndex -= length;
	}

	const sfc = `<template>${html}</template>`;
	if (styles.length === 0) {
		return sfc;
	} else {
		return `${sfc}<style scoped>${styles}</style>`;
	}
}
