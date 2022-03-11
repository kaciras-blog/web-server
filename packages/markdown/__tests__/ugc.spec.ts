import { expect, it } from "vitest";
import MarkdownIt from "markdown-it/lib";
import UGC from "../lib/ugc";

it("should set the attribute", () => {
	const markdownIt = new MarkdownIt();
	markdownIt.use(UGC);

	const html = markdownIt.render("[test](http://example.com)");
	expect(html).toBe('<p><a href="http://example.com" rel="ugc,nofollow">test</a></p>');
});
