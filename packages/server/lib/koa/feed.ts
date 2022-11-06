import { Feed } from "feed";
import { ExtendableContext } from "koa";
import MarkdownIt from "markdown-it";
import { Footnote, Media, TOC } from "@kaciras-blog/markdown";
import { once } from "../functions.js";
import { buildURL, CachedFetcher } from "../fetch-helper.js";
import { ResolvedConfig } from "../config.js";

const markdownIt = new MarkdownIt();
markdownIt.use(TOC);
markdownIt.use(Media);
markdownIt.use(Footnote);

interface FeedContext extends ExtendableContext {
	params: { type: string };
}

export default function feedMiddleware(config: ResolvedConfig) {
	const { author, title } = config.app;
	const baseURL = config.backend.internal;

	const getLinksFor = (origin: string) => ({
		rss: `${origin}/feed/rss`,
		json: `${origin}/feed/json`,
		atom: `${origin}/feed/atom`,
	});

	async function buildFeed(origin: string, response: Response) {
		const { items } = await response.json();

		const feed = new Feed({
			title,
			id: origin + "/",
			link: origin + "/",
			language: "zh-CN",
			favicon: `${origin}/favicon.ico`,
			copyright: "CC-BY-4.0",
			feedLinks: getLinksFor(origin),
		});

		feed.items = items.map((article: any) => ({
			title: article.title,
			image: origin + article.cover,
			date: new Date(article.update),
			published: new Date(article.create),
			description: article.summary,
			author: {
				name: author,
			},
			link: `${origin}/article/${article.id}/${article.urlTitle}`,
			content: markdownIt.render(article.content),
		}));

		// 几个输出的结果也缓存一下，一个大约占 60K 内存
		feed.json1 = once(feed.json1);
		feed.rss2 = once(feed.rss2);
		feed.atom1 = once(feed.atom1);
		return feed;
	}

	// Feed 里包含了文章的内容，其需要从 Markdown 转换成 HTML 会消耗蚊子大点性能，
	// 虽然缓存这东西也没啥意义，但是既然写了个 CachedFetcher，怎么也得拿出来用用。
	const fetcher = new CachedFetcher(7 * 86400 * 1000);

	return async (ctx: FeedContext) => {
		const url = buildURL(baseURL, "/articles", {
			origin: ctx.origin,
			content: true,
			count: 10,
			sort: "id,DESC",
			category: ctx.query.category,
			recursive: true,
		});
		const feed = await fetcher.request(url, r => buildFeed(ctx.origin, r));

		switch (ctx.params.type) {
			case "rss":
				ctx.body = feed.rss2();
				ctx.type = "application/rss+xml; charset=utf-8";
				break;
			case "atom":
				ctx.body = feed.atom1();
				ctx.type = "application/atom+xml; charset=utf-8";
				break;
			case "json":
				ctx.body = feed.json1();
				ctx.type = "application/json; charset=utf-8";
				break;
			default:
				ctx.status = 404;
				ctx.body = { message: "不支持的 Feed 类型", links: getLinksFor(ctx.origin) };
		}
	};
}
