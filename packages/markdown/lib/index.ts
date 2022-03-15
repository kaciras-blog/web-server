import MarkdownIt from "markdown-it";
import AnchorRaw from "markdown-it-anchor";

export { default as TOC } from "markdown-it-toc-done-right";

export * from "./media.js";

export { default as UGC } from "./ugc.js";
export { default as Media } from "./media.js";

/**
 * 给标题加上锚点，是对 markdown-it-anchor 的简单封装。
 */
export function Anchor(markdownIt: MarkdownIt) {
	markdownIt.use<AnchorRaw.AnchorOptions>(AnchorRaw, {
		permalink: AnchorRaw.permalink.linkInsideHeader({
			placement: "after",
			ariaHidden: true,
			class: "anchor-link",
		}),
		slugify: title => title.trim().toLowerCase().replace(/\s+/g, "-"),
	});
}

/**
 * 给行内代码加个 inline-code 类以便跟代码块区别开。
 */
export function Classify(markdownIt: MarkdownIt) {
	const { rules } = markdownIt.renderer;
	const raw = rules.code_inline!;

	rules.code_inline = (tokens, idx, options, env, self) => {
		const token = tokens[idx];
		token.attrPush(["class", "inline-code"]);
		return raw(tokens, idx, options, env, self);
	};
}
