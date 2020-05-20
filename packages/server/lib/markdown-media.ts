/*
 * 自定义的Markdown语法，用于插入视频、音频等。
 * 格式：@<tag>[<label>](<src>){ <attributes> }
 *
 * Example:
 * @video[label text](/foo/bar.mp4){ loop muted poster="/poster.jpg" }
 * Html:
 * <video src="/foo/bar.mp4" loop muted poster="/poster.jpg">label text</video>
 *
 * 【为何不直接写HTML】
 * 一旦写死HTML，以后想改动渲染结果就得把文章全扫一遍，麻烦。
 */
import MarkdownIt from "markdown-it";
import StateInline from "markdown-it/lib/rules_inline/state_inline";
import Token from "markdown-it/lib/token";

interface MediaToken extends Token {
	src: string;
}

const DIRECTIVE_NAME_RE = /^[a-z][a-z0-9\-_]*/i;

function parseMedia(state: StateInline, silent: boolean) {
	let { pos } = state;
	const src = state.src.slice(0, state.posMax);

	if (src.charCodeAt(pos) !== 0x40) {
		return false;
	}

	const match = DIRECTIVE_NAME_RE.exec(src.slice(++pos));
	if (!match) {
		return false;
	}
	const directive = match[0];
	pos += directive.length;

	const label = parseBracket(src, pos, "[", "]");
	if (label === null) {
		return false;
	}
	pos += label.length + 2;

	let link = parseBracket(src, pos, "(", ")");
	if (link === null) {
		return false;
	}
	pos += link.length + 2;

	link = state.md.normalizeLink(link);
	if (!state.md.validateLink(link)) {
		link = ""; // 谨防XSS
	}

	const attributes = parseBracket(src, pos, "{", "}");
	if (attributes === null) {
		return false;
	}
	pos += attributes.length + 2;

	state.pos = pos;
	if (!silent) {
		const token = state.push("media", directive, 0) as MediaToken;
		token.src = link;
		token.level = state.level;
		token.content = state.md.utils.unescapeMd(label);

		// TODO: split attrs
		token.attrs = [["attrs", attributes.trim()]];
	}

	return true;
}

function parseBracket(src: string, pos: number, start: string, end: string) {
	if (src.charAt(pos) !== start) {
		return null;
	}
	let i = pos + 1;

	while (i < src.length) {
		const e = src.indexOf(end, i);
		if (e === -1) {
			return null;
		}
		if (src.charAt(e - 1) === "\\") {
			i = e + 1;
		} else {
			return src.substring(pos + 1, e);
		}
	}

	return null; // close bracket not found
}

function renderMedia(tokens: Token[], idx: number) {
	const token = tokens[idx] as MediaToken;
	const { tag, attrs, src, content } = token;
	return `<${tag} src="${src}" ${attrs![0][1]}>${content}</${tag}>`;
}

export default function install(markdownIt: MarkdownIt) {
	markdownIt.inline.ruler.before("emphasis", "media", parseMedia);
	markdownIt.renderer.rules.media = renderMedia;
}
