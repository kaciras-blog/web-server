import StateBlock from "markdown-it/lib/rules_block/state_block.js";
import MarkdownIt from "markdown-it";

function search(state: StateBlock, pattern: string, line: number, endLine: number) {
	const { src, bMarks } = state;
	for (; line < endLine; line++) {
		if (src.startsWith(pattern, bMarks[line])) return line;
	}
}

function parse(state: StateBlock, startLine: number, endLine: number, silent: boolean) {
	const { src, md, bMarks } = state;
	let line = startLine;

	if (!src.startsWith("<details>", bMarks[line++])) {
		return false;
	}

	let summaryEnd;
	if (src.startsWith("<summary>", bMarks[line])) {
		summaryEnd = search(state, "</summary>", line + 1, endLine);
		if (summaryEnd === undefined) {
			return false;
		}
		line = summaryEnd + 1;
	}

	const blockEnd = search(state, "</details>", line, endLine);
	if (blockEnd === undefined) {
		return false;
	}

	const oldParent = state.parentType;
	const oldLineMax = state.lineMax;
	(state.parentType as string) = "collapsible";
	state.lineMax = blockEnd;

	let token = state.push("collapsible_open", "details", 1);
	token.block = true;
	token.markup = "<details>";
	token.map = [startLine, blockEnd];

	if (summaryEnd) {
		state.push("summary_open", "summary", 1);

		// md.inline.parse(params, md, state.env, tokens);
		token = state.push("inline", "", 0);
		token.children = [];
		token.content = src.slice(bMarks[startLine + 1] + 9, bMarks[summaryEnd]);

		state.push("summary_close", "summary", -1);
	}

	md.block.tokenize(state, line, blockEnd);

	token = state.push("collapsible_close", "details", -1);
	token.block = true;
	token.markup = "</details>";

	state.parentType = oldParent;
	state.lineMax = oldLineMax;
	state.line = blockEnd + 1;
	return true;
}

export default function (markdownIt: MarkdownIt) {
	markdownIt.block.ruler.before("fence", "collapsible", parse, {
		alt: ["paragraph", "reference", "blockquote", "list"],
	});
}
