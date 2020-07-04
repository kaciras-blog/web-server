/*
 * 自定义的Markdown语法，用于插入视频、音频等，
 * 该语句是一个块级元素，因为目前没有图文混排的需求。
 *
 * 格式：@<type>[<label>](<src>){ <attributes> }
 * - type: 类型
 * - label: 替代内容或标签
 * - src: 源链接
 * - attributes: 附加属性
 *
 * 其中 { <attributes> } 部分可用于设置宽高等，其应当是可省略的，Markdown的原则是只关注内容。
 *
 * Example:
 * @video[](/foo/bar.mp4){ loop muted width="300" height="100" }
 * @gif[A animated image](/data/gif-to-video.mp4){ width="300" height="100" }
 *
 * 【为何不直接写HTML】
 * Markdown本身是跟渲染结果无关的，不应该和HTML绑死，而且写HTML不利于修改。
 * 而且直接写HTML安全性太差，要转义也很麻烦，难以开放给用户。
 */
import MarkdownIt from "markdown-it";
import Token from "markdown-it/lib/token";
import StateBlock from "markdown-it/lib/rules_block/state_block";

type Attributes = { [key: string]: string | true };

interface MediaToken extends Token {
	src: string;
	attributes: Attributes;
}

const BASE_RE = /^@([a-z][a-z0-9\-_]*)\[([^\]]*)]\(([^)]*)\)/;

function parseMedia(state: StateBlock, startLine: number, endLine: number, silent: boolean) {
	const posMax = state.eMarks[startLine];
	const pos = state.tShift[startLine] + state.bMarks[startLine];

	const match = BASE_RE.exec(state.src.slice(pos, posMax));
	if (!match) {
		return false;
	}

	const [base, type, label, reference] = match;

	let link = state.md.normalizeLink(reference);
	if (!state.md.validateLink(link)) {
		link = ""; // 谨防XSS
	}

	let attributes
	try {
		attributes = parseAttributes(state, pos + base.length, posMax);
	} catch (e) {
		return false;
	}

	if (!silent) {
		const token = state.push("media", type, 0) as MediaToken;
		token.src = link;
		token.content = state.md.utils.unescapeMd(label);
		token.attributes = attributes;
		token.map = [startLine, state.line];
	}

	state.line = startLine + 1;
	return true;
}

enum ParseState {
	Free,
	Key,
	Value,
}

const ESCAPE_RE = /\\[\\"]/

function parseAttributes(state: StateBlock, index: number, end: number) {
	const { src } = state;

	if (src.charCodeAt(index) !== 0x7B) {
		return {};
	}

	const attributes: Attributes = {};

	let parsing = ParseState.Free;
	let key = "";
	let start = index;

	while (++index < end) {
		const ch = src.charCodeAt(index);

		if (ch === 0x7D /* } */) {
			if (parsing !== ParseState.Value) {
				break;
			}
		}

		if (parsing === ParseState.Free) {
			if (state.md.utils.isWhiteSpace(ch)) {
				continue;
			}
			start = index;
			parsing = ParseState.Key;
		} else if (parsing === ParseState.Key) {
			if (state.md.utils.isWhiteSpace(ch)) {
				parsing = ParseState.Free;
				attributes[src.substring(start, index)] = true;
			}
			if (ch !== 0x3D /* = */) {
				continue;
			}
			if (src.charCodeAt(index + 1) !== 0x22 /* " */) {
				throw new Error("Expect double quotes, but: " + src.charAt(index));
			}
			key = src.substring(start, index);
			index += 2;
			start = index;
			parsing = ParseState.Value;
		} else if (parsing === ParseState.Value) {
			if (src.charCodeAt(index) !== 0x22) {
				continue;
			}
			if (src.charCodeAt(index - 1) === 0x5C /* \ */) {
				continue;
			}
			parsing = ParseState.Free;
			attributes[key] = src.substring(start, index).replace(ESCAPE_RE, "$1");
		}
	}

	if (parsing !== ParseState.Free) {
		throw new Error("Truncated")
	}

	return attributes;
}

function renderMedia(tokens: Token[], idx: number) {
	const token = tokens[idx] as MediaToken;
	const { tag, attributes, src, content } = token;

	switch (tag) {
		case "gif":
			return renderGIFVideo(src, content, attributes);
		case "video":
			return `<${tag} src="${src}">${content}</${tag}>`;
	}

	throw new Error("Unsupported media type: " + tag);
}

function renderGIFVideo(src: string, alt: string, attrs: Attributes) {
	return `<div class="video"><video src="${src}"></video></div>`;
}

export default function install(markdownIt: MarkdownIt) {
	markdownIt.block.ruler.before("html_block", "media", parseMedia);
	markdownIt.renderer.rules.media = renderMedia;
}
