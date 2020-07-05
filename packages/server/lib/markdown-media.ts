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

	href = md.utils.unescapeMd(href);
	href = md.normalizeLink(href);
	if (!md.validateLink(href)) href = "";

	if (!silent) {
		const token = state.push("media", type, 0);
		token.map = [startLine, state.line];
		token.attrs = [["src", href]]
		token.content = state.md.utils.unescapeMd(label);
	}

	state.line = startLine + 1;
	return true;
}

function parseBracket(src: string, s: number, e: number, begin: number, close: number) {
	if (src.charCodeAt(s) !== begin) {
		throw new Error("Begin bracket not found");
	}

	s += 1;
	let level = 1;

	for (let i = s; i < e; i++) {
		const ch = src.charCodeAt(i);

		if (ch === begin) {
			level++;
		} else if (ch === close) {
			level--;
			if (level === 0) {
				return src.slice(s, i);
			}
		}
	}

	throw new Error("Close bracket count not match the begin");
}

/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
 *                            Renderer
 * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */

function renderMedia(tokens: Token[], idx: number) {
	const token = tokens[idx];
	const { tag, content } = token;
	const src = token.attrGet("src")!;

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
	if (poster) {
		attrs += ` poster="${poster}"`;
	}
	return `<div class="video"><video ${attrs}></video></div>`;
}

function renderGIFVideo(src: string, _: string) {
	return `<div class="video"><video src="${src}" loop muted></video></div>`;
}

export default function install(markdownIt: MarkdownIt) {
	markdownIt.block.ruler.before("html_block", "media", parseMedia);
	markdownIt.renderer.rules.media = renderMedia;
}
