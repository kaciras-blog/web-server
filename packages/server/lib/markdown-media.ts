/*
 * 自定义的Markdown语法，用于插入视频、音频等，
 * 该语句是一个块级元素，因为目前没有图文混排的需求。
 *
 * 格式：@<type>[<label>](<src>)
 * - type: 类型
 * - label: 替代内容或标签
 * - src: 源链接
 *
 * Example:
 * @gif[A animated image](/data/gif-to-video.mp4?vw=300&vh=100)
 *
 * 【为何不直接写HTML】
 * Markdown本身是跟渲染结果无关的，不应该和HTML绑死，而且写HTML不利于修改。
 * 而且直接写HTML安全性太差，要转义也很麻烦，难以开放给用户。
 */
import MarkdownIt from "markdown-it";
import { escapeHtml, unescapeMd } from "markdown-it/lib/common/utils";
import Token from "markdown-it/lib/token";
import StateBlock from "markdown-it/lib/rules_block/state_block";

const BASE_RE = function () {
	const TYPE = /([a-z][a-z0-9\-_]*)/i.source;
	const LABEL = /\[(.*?)(?<!\\)]/.source;
	const HREF = /\((.*?)(?<!\\)\)/.source;
	return new RegExp(`@${TYPE}${LABEL}${HREF}`)
}();

function parseMedia(state: StateBlock, startLine: number, endLine: number, silent: boolean) {
	const { src, md, eMarks, tShift, bMarks } = state;

	const posMax = eMarks[startLine];
	const pos = tShift[startLine] + bMarks[startLine];

	const match = BASE_RE.exec(src.slice(pos, posMax));
	if (!match) {
		return false;
	}

	const [, type, label] = match;
	let href = match[3];

	href = unescapeMd(href);
	href = md.normalizeLink(href);
	if (!md.validateLink(href)) href = "";

	if (!silent) {
		const token = state.push("media", type, 0);
		token.attrs = [["src", href]]
		token.content = unescapeMd(label);
		token.map = [startLine, state.line];
	}

	state.line = startLine + 1;
	return true;
}

/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
 *                            Renderer
 * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */

export default function install(markdownIt: MarkdownIt) {

	function renderMedia(tokens: Token[], idx: number) {
		const token = tokens[idx];

		const { tag } = token;
		const content = escapeHtml(token.content);
		const src = escapeHtml(token.attrGet("src")!);

		switch (tag) {
			case "gif":
				return renderGIFVideo(src, content);
			case "video":
				return renderVideo(src, content);
		}

		throw new Error("Unsupported media type: " + tag);
	}

	function renderVideo(src: string, poster: string) {
		let attrs = `src="${src}"`;

		poster = markdownIt.normalizeLink(poster);
		if (poster && markdownIt.validateLink(poster)) {
			attrs += ` poster="${poster}"`;
		}

		return `<video ${attrs} controls></video>`;
	}

	function renderGIFVideo(src: string, label: string) {
		return `<video title="${label}" src="${src}" loop muted></video>`;
	}

	markdownIt.block.ruler.before("html_block", "media", parseMedia);
	markdownIt.renderer.rules.media = renderMedia;
}
