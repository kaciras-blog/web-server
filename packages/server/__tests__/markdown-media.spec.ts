import MarkdownIt from "markdown-it/lib";
import MediaPlugin from "../lib/markdown-media";

it('should convert to html', () => {
	const markdown = `
text before

@video[](/video/foo.mp4){ loop="loop" muted }

text after`
	const markdownIt = new MarkdownIt();
	markdownIt.use(MediaPlugin);

	const html = markdownIt.render(markdown);
	expect(html).toMatchSnapshot();
});
