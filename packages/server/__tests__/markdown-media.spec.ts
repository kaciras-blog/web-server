import MarkdownIt from "markdown-it/lib";
import MediaPlugin from "../lib/markdown-media";

const markdownIt = new MarkdownIt();
markdownIt.use(MediaPlugin);

it('should convert to html', () => {
	const markdown = `
text before

@video[](/video/foo.mp4){ loop="loop" muted }

text after`

	const html = markdownIt.render(markdown);
	expect(html).toMatchSnapshot();
});

it('should unescape chars', () => {
	const html = markdownIt.render("@video[[hello\\]](/video/foo.mp4){ loop muted }");
	expect(html).toMatchSnapshot();
});
