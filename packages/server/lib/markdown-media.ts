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

	const reference = parseBracket(src, pos, "(", ")");
	if (reference === null) {
		return false;
	}
	pos += reference.length + 2;

	const attributes = parseBracket(src, pos, "{", "}");
	if (attributes === null) {
		return false;
	}
	pos += attributes.length + 2;

	state.pos = pos;
	if (!silent) {
		const token = state.push('media', directive, 0) as MediaToken;
		token.level = state.level;
		token.content = label;
		token.src = reference;

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

	return null;
}

function renderMedia(tokens: Token[], idx: number) {
	const token = tokens[idx] as MediaToken;
	const { tag, attrs, src } = token;
	return `<${tag} src="${src}" ${attrs![0][1]}></${tag}>`;
}

export default function install(markdownIt: MarkdownIt) {
	markdownIt.inline.ruler.before('emphasis', 'media', parseMedia);
	markdownIt.renderer.rules.media = renderMedia;
}
