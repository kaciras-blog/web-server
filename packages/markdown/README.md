# @kaciras-blog/markdown

Kaciras Blog 的 Markdown 扩展集合，处理自定义的语法。

包含了以下插件：

* Anchor：给标题加上锚点，使其能够靠 URL 的 hash 部分来跳转。
* Classify：为一些元素加上 `class` 以便与其他的区分。
* TOC：Table of content.
* Media：处理自定义的语法 `@type[label](href)`。
* UGC：给链接元素加上 `rel="ugc,nofollow"`，用于第三方提供的内容。

```javascript
import { Anchor, Classify, TOC, Media } from "@kaciras-blog/markdown";
import MarkdownIt from "markdown-it";

const renderer = new MarkdownIt();
articleRenderer.use(Anchor);
articleRenderer.use(TOC);
articleRenderer.use(Media);
articleRenderer.use(Classify);
```
