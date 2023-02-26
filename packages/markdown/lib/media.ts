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
 * TODO:附加属性的语法
 * 有一种提案是在后面用大括号：@type[...](...){ key="value" }
 * 目前只有宽高两个属性，且图片已经用加在 URL 参数上的形式了，就暂未支持它。
 *
 * 【为什么不用 GitLab Flavored Markdown】
 * 复用图片的语法，依靠扩展名来区分媒体类型有两个缺陷：
 * - 无法解决用视频来模拟GIF图片的需求
 * - URL 必须要有扩展名，但并不是所有系统都是这样（比如 Twitter）
 *
 * https://gitlab.com/help/user/markdown#videos
 *
 * 【为何不直接写HTML】
 * Markdown 本身是跟渲染结果无关的，不应该和 HTML 绑死，而且写HTML不利于修改。
 * 而且直接写 HTML 安全性太差，要转义也很麻烦，难以开放给用户。
 */
import MarkdownIt from "markdown-it";
import { unescapeMd } from "markdown-it/lib/common/utils.js";
import StateBlock from "markdown-it/lib/rules_block/state_block.js";

function parseMedia(state: StateBlock, startLine: number, endLine: number, silent: boolean) {
	const offset = state.tShift[startLine] + state.bMarks[startLine];

	// JS 的傻逼正则不能设置结束位置，必须得截字符串。
	const src = state.src.slice(offset, state.eMarks[startLine]);

	let directive: GenericDirective;
	try {
		directive = tokenize(src);
	} catch (e) {
		return false;
	}

	if (!silent) {
		const { type, label, href } = directive;
		const token = state.push("media", type, 0);
		token.attrs = [["href", href]];
		token.content = label;
		token.map = [startLine, state.line];
	}

	state.line = startLine + 1;
	return true;
}

interface GenericDirective {
	type: string;
	label: string;
	href: string;
}

/**
 * 解析指令语法，从中提取出各个部分并处理转义。
 *
 * 【坑爹的兼容性】
 * 原本是用环视处理转义，不支持括号计数，直接一个正则就能搞定。
 * 但是傻逼 Safari 不支持环视，非要让劳资手写 Parser 艹。
 *
 * @param src 待解析的文本
 * @return 包含各个部分的对象
 * @throws 如果给定的文本不符合指令语法
 */
function tokenize(src: string) {
	const match = /^@([a-z][a-z0-9\-_]*)/i.exec(src);
	if (!match) {
		throw new Error("Invalid type syntax");
	}

	const [typePart, type] = match;
	const labelEnd = readBracket(src, typePart.length, 0x5B, 0x5D);
	const srcEnd = readBracket(src, labelEnd + 1, 0x28, 0x29);

	if (srcEnd + 1 !== src.length) {
		throw new Error("There are extra strings after the directive");
	}

	const href = unescapeMd(src.slice(labelEnd + 2, srcEnd));
	const label = unescapeMd(src.slice(typePart.length + 1, labelEnd));

	return { type, label, href } as GenericDirective;
}

/**
 * 解析左右分别是正反括号的内容，找到结束的位置，支持括号计数和斜杠转义。
 *
 * @param src 文本
 * @param i 起始位置
 * @param open 左括号的字符码
 * @param close 右括号字符码
 * @return 结束位置
 * @throws 如果给定的片段不符合语法
 */
function readBracket(src: string, i: number, open: number, close: number) {
	if (src.charCodeAt(i) !== open) {
		const expect = String.fromCharCode(open);
		const actual = src.charAt(i);
		throw new Error(`Expect ${expect}, but found ${actual}`);
	}

	let level = 1;

	while (++i < src.length) {
		switch (src.charCodeAt(i)) {
			case 0x5C:
				++i;
				break;
			case open:
				level++;
				break;
			case close:
				level--;
				break;
		}
		if (level === 0) return i;
	}

	throw new Error(`Bracket count does not match, level=${level}`);
}

/**
 * 检查链接，处理 URL 转义和 XSS 攻击，如果有风险则返回空字符串。
 *
 * @param md MarkdownIt 的实例
 * @param link 需要检查的链接
 * @return 安全的链接，可以直接写进HTML
 */
export function checkLink(md: MarkdownIt, link: string) {
	link = md.normalizeLink(link);
	return md.validateLink(link) ? link : "";
}

/**
 * 自定义渲染函数，以 type 作为键，值为渲染函数。
 * 其中 href 已经使用上面的 checkLink 对 XSS 做了检查。
 *
 * 【为何在渲染函数中检查链接】
 * 与传统的 Markdown 语法不同，通用指令旨在支持一系列的扩展功能，其几个片段的意义由指令决定，
 * 解析器只做提取，故只有在渲染函数中才能确定字段是不是链接。
 */
export interface DirectiveMap {

	[type: string]: (href: string, label: string, md: MarkdownIt) => string;
}

/**
 * 默认的指令表，有 audio、video 和 gif 类型，简单地渲染为 <audio> 和 <video>
 */
export const defaultDirectiveMap: Readonly<DirectiveMap> = {

	audio(src: string) {
		return `<audio src="${src}" controls></audio>`;
	},

	video(src: string, poster: string, md: MarkdownIt) {
		let attrs = `src="${src}"`;

		poster = md.normalizeLink(poster);
		if (poster && md.validateLink(poster)) {
			attrs += ` poster="${poster}"`;
		}

		return `<video ${attrs} controls></video>`;
	},

	// 仍然加上 controls 避免无法播放
	gif(src: string) {
		return `<video src="${src}" loop muted controls></video>`;
	},
};

/**
 * MarkdownIt的插件函数，用法：markdownIt.use(require("markdown-media"), { ... })
 *
 * 可以自定义map参数设置自定义渲染函数，也可以直接修改 markdownIt.renderer.rules.media
 *
 * @param markdownIt markdownIt实例
 * @param map 渲染函数选项，用于自定义
 */
export default function (markdownIt: MarkdownIt, map = defaultDirectiveMap) {
	markdownIt.renderer.rules.media = (tokens, idx) => {
		const token = tokens[idx];
		const { tag, content } = token;
		const href = token.attrGet("href")!;

		const renderFn = map[tag];
		if (!renderFn) {
			return `[Unknown media type: ${tag}]`;
		}

		return renderFn(checkLink(markdownIt, href), content, markdownIt);
	};

	markdownIt.block.ruler.before("html_block", "media", parseMedia);
}
