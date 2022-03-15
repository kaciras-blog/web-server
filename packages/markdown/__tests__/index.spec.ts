import { expect, it } from "vitest";
import MarkdownIt from "markdown-it/lib";
import { Anchor, Classify } from "../lib/index";

it("should add class to inlined code block", () => {
	const markdownIt = new MarkdownIt();
	markdownIt.use(Classify);

	expect(markdownIt.render("`foobar`")).toMatchSnapshot();
});

it("should add anchor to titles", () => {
	const markdownIt = new MarkdownIt();
	markdownIt.use(Anchor);

	expect(markdownIt.render("# foobar")).toMatchSnapshot();
});
