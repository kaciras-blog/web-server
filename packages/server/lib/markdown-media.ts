/*
 * 自定义的 Markdown 语法，用于插入视频、音频等，
 * 该语句是一个块级元素，因为目前没有图文混排的需求。
 *
 * 格式：@<type>[<label>](<href>)
 * - type: 类型
 * - label: 替代内容或标签
 * - href: 源链接
 *
 * Example:
 * @gif[A animated image](/data/gif-to-video.mp4?vw=300&vh=100)
 * @video[/poster.png](/foo/bar/mp4)
 *
 * 【为何不直接写HTML】
 * Markdown本身是跟渲染结果无关的，不应该和HTML绑死，而且写HTML不利于修改。
 * 而且直接写HTML安全性太差，要转义也很麻烦，难以开放给用户。
 */
import MarkdownIt from "markdown-it";
import { escapeHtml, unescapeMd } from "markdown-it/lib/common/utils";
import StateBlock from "markdown-it/lib/rules_block/state_block";

/**
 * 括号里的字段仅支持斜杠转义，没有实现括号计数。
 * 通常是两种都支持，但斜杠转义可以代替计数，而且它是必需的，再者斜杠转义用环视写起来也简单。
 */
const BASE_RE = function () {
	const type = /([a-z][a-z0-9\-_]*)/.source;
	const label = /\[(.*?)(?<!\\)]/.source;
	const href = /\((.*?)(?<!\\)\)/.source;
	return new RegExp(`@${type}${label}${href}`, "i")
}();

function parseMedia(state: StateBlock, startLine: number, endLine: number, silent: boolean) {
	const { src, md } = state;

	const pMax = state.eMarks[startLine];
	const p = state.tShift[startLine] + state.bMarks[startLine];

	const match = BASE_RE.exec(src.slice(p, pMax));
	if (!match) {
		return false;
	}

	const [, type, label] = match;

	let href = unescapeMd(match[3]);
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

export interface RendererMap {
	[type: string]: (href: string, label: string, md: MarkdownIt) => string;
}

export const DefaultMap: Readonly<RendererMap> = {

	video(src: string, poster: string, md: MarkdownIt) {
		let attrs = `src="${src}"`;

		poster = md.normalizeLink(poster);
		if (poster && md.validateLink(poster)) {
			attrs += ` poster="${poster}"`;
		}

		return `<video ${attrs} controls></video>`;
	},

	gif(src: string) {
		return `<video src="${src}" loop muted></video>`;
	},
}

export default function install(markdownIt: MarkdownIt, map: RendererMap = DefaultMap) {

	markdownIt.renderer.rules.media = (tokens, idx) => {
		const token = tokens[idx];

		const { tag } = token;
		const label = escapeHtml(token.content);
		const href = escapeHtml(token.attrGet("src")!);

		const renderFn = map[tag];
		if (!renderFn) {
			return `[Unknown media type: ${tag}]`;
		}

		return renderFn(href, label, markdownIt);
	};

	markdownIt.block.ruler.before("html_block", "media", parseMedia);

}
