import MarkdownIt from "markdown-it/lib";
import { expect, it } from "vitest";
import Collapsible from "../lib/collapsible.js";

const markdownIt = new MarkdownIt();
markdownIt.use(Collapsible);

it("should works without summary", () => {
	const html = markdownIt.render(`
<details>
# Test

Inside
</details>
After
	`);
	expect(html).toMatchInlineSnapshot(`
		"<details>
		<h1>Test</h1>
		<p>Inside</p>
		</details>
		<p>After</p>
		"
	`);
});


it("should render summary", () => {
	const html = markdownIt.render(`
<details>
<summary>
# Some \`code\` text
</summary>
# Test

Inside
</details>`);
	expect(html).toMatchInlineSnapshot(`
		"<details>
		<summary>
		# Some <code>code</code> text
		</summary>
		<h1>Test</h1>
		<p>Inside</p>
		</details>
		"
	`);
});

it("should restrict summary that must at first", () => {
	const html = markdownIt.render(`
<details>

<summary>
# Header
</summary>
Content
</details>`);
	expect(html).toMatchInlineSnapshot(`
		"<details>
		<p>&lt;summary&gt;</p>
		<h1>Header</h1>
		<p>&lt;/summary&gt;
		Content</p>
		</details>
		"
	`);
});

it("should skip brokens", () => {
	const html = markdownIt.render(`
<details>
Content`);
	expect(html).toMatchInlineSnapshot(`
		"<p>&lt;details&gt;
		Content</p>
		"
	`);
}); 
