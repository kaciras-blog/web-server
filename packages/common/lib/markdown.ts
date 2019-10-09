import MarkdownIt from "markdown-it";
import katex from "@iktakahiro/markdown-it-katex";
import tableOfContent from "markdown-it-toc-done-right";

export const markdown = new MarkdownIt();

markdown.use(katex);
markdown.use(tableOfContent);
