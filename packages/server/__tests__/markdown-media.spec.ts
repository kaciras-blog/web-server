import MarkdownIt from "markdown-it/lib";
import MediaPlugin from "../lib/markdown-media";
import Token from "markdown-it/lib/token";

const markdownIt = new MarkdownIt();
markdownIt.use(MediaPlugin);

it("should convert to html", () => {
	const markdown = `
text before

@gif[A gif video](/video/foo.mp4)

text after`

	const html = markdownIt.render(markdown);
	expect(html).toMatchSnapshot();
});

describe("tokenizer", () => {
	let token: Token;

	markdownIt.renderer.rules.media = (t, i) => {
		token = t[i];
		return "No render result for tokenizer test";
	}

	it("should parse type, label, and href", () => {
		markdownIt.render("@gif[A gif video](/video/foo.mp4)");
		expect(token.tag).toBe("gif");
		expect(token.content).toBe("A gif video");
		expect(token.attrGet("src")).toBe("/video/foo.mp4");
	});

	it("should support escape ]", () => {
		markdownIt.render("@gif[A [gif\\] video]()");
		expect(token.content).toBe("A [gif] video");
	});

	it("should support escape )", () => {
		markdownIt.render("@gif[](/video/foo(bar\\).mp4)");
		expect(token.attrGet("src")).toBe("/video/foo(bar).mp4");
	});
});
