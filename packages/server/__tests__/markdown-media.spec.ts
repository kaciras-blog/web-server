import MarkdownIt from "markdown-it/lib";
import MediaPlugin from "../lib/markdown-media";
import Token from "markdown-it/lib/token";

describe("tokenizer", () => {
	let token: Token;

	const markdownIt = new MarkdownIt();
	markdownIt.use(MediaPlugin);

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

	it("should allow empty label and href", () => {
		markdownIt.render("@gif[]()");
		expect(token.content).toBe("");
		expect(token.attrGet("src")).toBe("");
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

describe("renderer", () => {
	const markdownIt = new MarkdownIt();
	markdownIt.use(MediaPlugin);

	it("should cooperate with others", () => {
		const markdown = `
text before

@gif[A gif video](/video/foo.mp4)

text after
`;
		expect(markdownIt.render(markdown)).toMatchSnapshot();
	});

	it("should render gif video", () => {
		expect(markdownIt.render("@gif[A gif video](/video/foo.mp4)")).toMatchSnapshot();
	});

	it("should render video", () => {
		expect(markdownIt.render("@video[/poster.png](/video/foo.mp4)")).toMatchSnapshot();
	});

	it("should escape html", () => {
		expect(markdownIt.render('@video[/f"o"o](/bar?a=b&c=d)')).toMatchSnapshot();
	});

	// 因为我用的 MarkdownIt 自带的 normalizeLink & validateLink，所以只测一种形式避免忘记检查
	it("should avoid XSS attack", () => {
		expect(markdownIt.render("@gif[](javascript:alert(1\\);)")).toMatchSnapshot();
		expect(markdownIt.render("@gif[<script>alert(1)</script>]()")).toMatchSnapshot();
		expect(markdownIt.render("@video[](javascript:alert(1\\);)")).toMatchSnapshot();
		expect(markdownIt.render("@video[javascript:alert(1\\);]()")).toMatchSnapshot();
	});
});
