import MarkdownIt from "markdown-it/lib";
import MediaPlugin, { MediaToken } from "../lib/markdown-media";

const markdownIt = new MarkdownIt();
markdownIt.use(MediaPlugin);

it("should convert to html", () => {
	const markdown = `
text before

@gif[A gif video](/video/foo.mp4){ width="1920" height="1080" }

text after`

	const html = markdownIt.render(markdown);
	expect(html).toMatchSnapshot();
});

it("should unescape chars in label", () => {
	const html = markdownIt.render('@video[/\\[hello\\]](/video/foo.mp4){loop width="1920" muted}');
	expect(html).toMatchSnapshot();
});

it("should unescape chars in property", () => {
	expect(markdownIt.render('@video[](/video/foo.mp4){ key="tes\\"t" }')).toMatchSnapshot();
});

it("should escape link", () => {
	const html = markdownIt.render("@video[](javascript:xss){}");
	expect(html).toMatchSnapshot();
});

describe("tokenizer", () => {
	let token: MediaToken;

	markdownIt.renderer.rules.media = (t, i) => {
		token = t[i] as MediaToken;
		return "No render result for tokenizer test";
	}

	it("should support escaping", () => {
		markdownIt.render('@video[](){ key="\\\\foo_\\"bar\\"" }');
		expect(token.properties.key).toBe('\\foo_"bar"');
	});

	it("should allow no char after key", () => {
		markdownIt.render("@video[](){loop}");
		expect(token.properties.loop).toBe(true);
	});

	it("should allow no char after value", () => {
		markdownIt.render('@video[](){key="123"}');
		expect(token.properties.key).toBe("123");
	});
});
