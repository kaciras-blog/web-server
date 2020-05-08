// 这里导出的仅供 Feed 使用
import MarkdownIt from "markdown-it";
import katex from "@iktakahiro/markdown-it-katex";
import tableOfContent from "markdown-it-toc-done-right";

export const markdown = new MarkdownIt({ html: true });

markdown.use(katex);
markdown.use(tableOfContent);
