import Token from "markdown-it/lib/token.js";
import MarkdownIt from "markdown-it";
import FootnoteRaw from "markdown-it-footnote";
import AnchorRaw from "markdown-it-anchor";

export { default as TOC } from "markdown-it-toc-done-right";

export * from "./media.js";

export { default as Collapsible } from "./collapsible.js";
export { default as UGC } from "./ugc.js";
export { default as Media } from "./media.js";

/**
 * 给标题加上锚点，是对 markdown-it-anchor 的简单封装。
 */
export function Anchor(markdownIt: MarkdownIt) {
	markdownIt.use<AnchorRaw.AnchorOptions>(AnchorRaw, {
		permalink: AnchorRaw.permalink.linkInsideHeader({
			placement: "after",
			class: "anchor-link",
		}),
		slugify: title => title.trim().toLowerCase().replace(/\s+/g, "-"),
	});
}

/**
 * 添加脚注功能，就是像论文一样的上角标引用。
 *
 * 因为可能用于评论，所以修改渲染函数去掉横线，避免跟评论间的分隔混淆。
 * 可以通过 md.render 的第二个参数中添加 docId 来给锚点添加前缀，避免重复。
 *
 * @see https://www.markdownguide.org/extended-syntax/#footnotes
 */
export function Footnote(markdownIt: MarkdownIt) {
	markdownIt.use(FootnoteRaw);
	const { rules } = markdownIt.renderer;

	rules.footnote_block_open = () => (
		"<h2 class='footnotes'>参考</h2>" +
		"<ol class='footnotes-list'>"
	);
	rules.footnote_block_close = () => "</ol>";
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

/**
 * 检查文本中所有文件链接的插件，文件链接包括链接的 href，以及媒体的源。
 *
 * @param markdownIt 要安装到的 MarkdownIt 对象。
 * @param handler 找到的链接将传递给这个函数。
 */
export function CollectLinks(markdownIt: MarkdownIt, handler: (url: string) => void) {

	function check(tokens: Token[]) {
		for (const token of tokens) {
			switch (token.type) {
				case "inline":
					check(token.children!);
					break;
				case "link_open":
				case "media":
					handler(token.attrGet("href")!);
					break;
				case "image":
					handler(token.attrGet("src")!);
					break;
			}
		}
	}

	markdownIt.core.ruler.push("collect-links", s => check(s.tokens));
}
