import MarkdownIt from "markdown-it/lib";
import MediaPlugin, { MediaToken } from "../lib/markdown-media";

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
	let token: MediaToken;

	markdownIt.renderer.rules.media = (t, i) => {
		token = t[i] as MediaToken;
		return "No render result for tokenizer test";
	}

	it("should support escaping", () => {
		markdownIt.render("@gif[A gif video](/video/foo.mp4)");
		expect(token.tag).toBe("gif");
		expect(token.content).toBe("A gif video");
		expect(token.src).toBe("/video/foo.mp4");
	});
});
