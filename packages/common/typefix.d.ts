// 一些没有类型定义的三方库

declare module "@iktakahiro/markdown-it-katex" {
	import MarkdownIt from "markdown-it";
	const plugin: (md: MarkdownIt, ...params: any[]) => void;
	export default plugin;
}

declare module "markdown-it-toc-done-right" {
	import MarkdownIt from "markdown-it";
	const plugin: (md: MarkdownIt, ...params: any[]) => void;
	export default plugin;
}
