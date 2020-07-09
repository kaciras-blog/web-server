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
 * 【语法相关讨论】
 * https://talk.commonmark.org/t/embedded-audio-and-video/441
 * https://talk.commonmark.org/t/generic-directives-plugins-syntax/444
 *
 * 【附加属性的语法】
 * 有一种提案是在后面用大括号：@type[...](...){ key="value" }
 * 目前只有宽高两个附加属性的需求，在图片上已经加在URL参数上，为了统一还是使用URL参数。
 *
 * 【为什么不用 GitLab Flavored Markdown】
 * 复用图片的语法，依靠扩展名来区分媒体类型有两个缺陷：
 * - 无法解决用视频来模拟GIF图片的需求
 * - URL必须要有扩展名，但并不是所有系统都是这样（比如Twitter）
 *
 * 【为何不直接写HTML】
 * Markdown本身是跟渲染结果无关的，不应该和HTML绑死，而且写HTML不利于修改。
 * 而且直接写HTML安全性太差，要转义也很麻烦，难以开放给用户。
 */
import MarkdownIt from "markdown-it";
import { unescapeMd } from "markdown-it/lib/common/utils";
import StateBlock from "markdown-it/lib/rules_block/state_block";

/**
 * 括号里的字段仅支持斜杠转义，没有实现括号计数。
 * 通常是两种都支持，但斜杠转义可以代替计数，而且它是必需的，再者斜杠转义用环视写起来也简单。
 *
 * 前后不允许空白，也没想到留空白能有什么用，语法严点能避免一些不必要的坑。
 */
const BASE_RE = function () {
	const type = /([a-z][a-z0-9\-_]*)/.source;
	const label = /\[(.*?)(?<!\\)]/.source;
	const href = /\((.*?)(?<!\\)\)/.source;
	return new RegExp(`^@${type}${label}${href}$`, "i")
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

/**
 * 自定义渲染函数，以 type 作为键，值为渲染函数
 */
export interface RendererMap {
	[type: string]: (href: string, label: string, md: MarkdownIt) => string;
}

/**
 * 默认的渲染函数，支持 video 和 gif 类型，简单地渲染为<video>元素
 */
export const DefaultRenderMap: Readonly<RendererMap> = {

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

/**
 * MarkdownIt的插件函数，用法：markdownIt.use(require("markdown-media"), { ... })
 *
 * 可以自定义map参数设置自定义渲染函数，也可以直接修改 markdownIt.renderer.rules.media
 *
 * @param markdownIt markdownIt实例
 * @param map 渲染函数选项，用于自定义
 */
export default function install(markdownIt: MarkdownIt, map: RendererMap = DefaultRenderMap) {

	markdownIt.renderer.rules.media = (tokens, idx) => {
		const token = tokens[idx];
		const { tag } = token;
		const href = token.attrGet("src")!;

		const renderFn = map[tag];
		if (!renderFn) {
			return `[Unknown media type: ${tag}]`;
		}

		return renderFn(href, token.content, markdownIt);
	};

	markdownIt.block.ruler.before("html_block", "media", parseMedia);
}
