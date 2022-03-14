import MarkdownIt from "markdown-it";
import AnchorRaw from "markdown-it-anchor";

export { default as TOC } from "markdown-it-toc-done-right";

export * from "./media.js";

export { default as UGC } from "./ugc.js";
export { default as Media } from "./media.js";

export function Anchor(markdownIt: MarkdownIt) {
	markdownIt.use<AnchorRaw.AnchorOptions>(AnchorRaw, {

		// 参考 MSDN 网站的做法，有 aria-labelledby 情况下不再需要内容
		permalink: AnchorRaw.permalink.linkInsideHeader({
			placement: "after",
			ariaHidden: true,
			class: "anchor-link",
		}),

		slugify: title => title.trim().toLowerCase().replace(/\s+/g, "-"),
	});
}
