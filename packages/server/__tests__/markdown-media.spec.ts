import MarkdownIt from "markdown-it/lib";
import MediaPlugin from "../lib/markdown-media";

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
