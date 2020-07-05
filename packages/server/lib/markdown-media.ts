/*
 * 自定义的Markdown语法，用于插入视频、音频等，
 * 该语句是一个块级元素，因为目前没有图文混排的需求。
 *
 * 格式：@<type>[<label>](<src>){ <properties> }
 * - type: 类型
 * - label: 替代内容或标签
 * - src: 源链接
 * - properties: 附加属性
 *
 * 其中 { <properties> } 部分可用于设置宽高等，其应当是可省略的，Markdown的原则是只关注内容。
 *
 * Example:
 * @gif[A animated image](/data/gif-to-video.mp4){ width="300" height="100" }
 *
 * 【为何不直接写HTML】
 * Markdown本身是跟渲染结果无关的，不应该和HTML绑死，而且写HTML不利于修改。
 * 而且直接写HTML安全性太差，要转义也很麻烦，难以开放给用户。
 */
import MarkdownIt from "markdown-it";
import Token from "markdown-it/lib/token";
import StateBlock from "markdown-it/lib/rules_block/state_block";

export type Properties = { [key: string]: string | true };

export interface MediaToken extends Token {
	src: string;
	properties: Properties;
}

class RegexBuilder {

	private pattern: string;

	constructor(pattern: RegExp) {
		this.pattern = pattern.source;
	}

	replace(name: string, value: RegExp) {
		this.pattern = this.pattern.replace(name, value.source);
		return this;
	}

	build() {
		return new RegExp(this.pattern);
	}
}

const BASE_RE = new RegexBuilder(/^@(TYPE)\[(LABEL)]\((HREF)\)/)
	.replace("TYPE", /[a-z][a-z0-9\-_]*/)
	.replace("LABEL", /(?:\[(?:\\.|[^[\]\\])*]|\\.|`[^`]*`|[^[\]\\`])*?/)
	.replace("HREF", /[^)]*/)
	.build();

function parseMedia(state: StateBlock, startLine: number, endLine: number, silent: boolean) {
	const { src, md, eMarks, tShift, bMarks } = state;

	const posMax = eMarks[startLine];
	const pos = tShift[startLine] + bMarks[startLine];

	const match = BASE_RE.exec(src.slice(pos, posMax));
	if (!match) {
		return false;
	}

	const [base, type, label, reference] = match;

	let link = md.normalizeLink(reference);
	if (!md.validateLink(link)) {
		link = ""; // 谨防XSS
	}

	const attributes: Properties = {};

	// 有 { 需要解析属性段
	if (src.charCodeAt(pos + base.length) === 0x7B) {
		if (src.charCodeAt(posMax - 1) !== 0x7D) {
			return false;
		}
		const section = src.slice(pos + base.length + 1, posMax - 1);
		try {
			parseProperties(section, attributes);
		} catch (e) {
			return false;
		}
	}

	if (!silent) {
		const token = state.push("media", type, 0) as MediaToken;
		token.src = link;
		token.content = state.md.utils.unescapeMd(label);
		token.properties = attributes;
		token.map = [startLine, state.line];
	}

	state.line = startLine + 1;
	return true;
}

function unescape(value: string) {
	return value.replace(/\\([\\"])/g, "$1")
}

const KEY_RE = /\s*(\w+)/;
const VALUE_RE = /"(.*?)(?<!\\)"/;

function isPairEnd(code: number) {
	return Number.isNaN(code) || code === 0x20 || code === 0x09;
}

function parseProperties(src: string, attributes: Properties) {

	function consumeToggle(kMatch: RegExpExecArray) {
		attributes[kMatch[1]] = true;
		src = src.slice(kMatch[0].length);
	}

	function consumeValue(kMatch: RegExpExecArray) {
		const len = kMatch[0].length;
		src = src.slice(len + 1);

		const vMatch = VALUE_RE.exec(src);
		if (!vMatch) {
			throw new Error("Expect double quotes, but: " + src.charAt(len));
		}

		attributes[kMatch[1]] = unescape(vMatch[1]);
		src = src.slice(vMatch[0].length);

		if (!isPairEnd(src.charCodeAt(0))) {
			throw new Error(`Invalid char: ${src.charAt(0)} after value`);
		}
	}

	let kMatch = KEY_RE.exec(src);
	while (kMatch) {
		const len = kMatch[0].length;
		const code = src.charCodeAt(len);

		if (isPairEnd(code)) {
			consumeToggle(kMatch);
		} else if (code === 0x3D) {
			consumeValue(kMatch);
		} else {
			throw new Error(`Invalid char: ${src.charAt(len)} after key`);
		}

		kMatch = KEY_RE.exec(src);
	}
}

/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
 *                            Renderer
 * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */

function renderMedia(tokens: Token[], idx: number) {
	const token = tokens[idx] as MediaToken;
	const { tag, properties, src, content } = token;

	switch (tag) {
		case "gif":
			return renderGIFVideo(src, content, properties);
		case "video":
			return renderVideo(src, content, properties);
	}

	throw new Error("Unsupported media type: " + tag);
}

function renderVideo(src: string, poster: string, _: Properties) {
	let attrs = `src="${src}"`;
	if (poster) {
		attrs += ` poster="${poster}"`;
	}
	return `<div class="video"><video ${attrs}></video></div>`;
}

function renderGIFVideo(src: string, _: string, __: Properties) {
	return `<div class="video"><video src="${src}" loop muted></video></div>`;
}

export default function install(markdownIt: MarkdownIt) {
	markdownIt.block.ruler.before("html_block", "media", parseMedia);
	markdownIt.renderer.rules.media = renderMedia;
}
