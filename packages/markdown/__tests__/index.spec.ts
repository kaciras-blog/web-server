import { expect, it } from "vitest";
import MarkdownIt from "markdown-it/lib";
import { Anchor, Classify } from "../lib/index";

it("should add class to inlined code block", () => {
	const markdownIt = new MarkdownIt();
	markdownIt.use(Classify);

	const html = markdownIt.render("`foobar`");
	expect(html).toBe('<p><code class="inline-code">foobar</code></p>\n');
});

it("should add anchor to titles", () => {
	const markdownIt = new MarkdownIt();
	markdownIt.use(Anchor);

	expect(markdownIt.render("# foobar")).toMatchSnapshot();
});
