import Axios, { AxiosResponse } from "axios";
import { Feed } from "feed";
import { ExtendableContext } from "koa";
import MarkdownIt from "markdown-it";
import KaTeX from "@iktakahiro/markdown-it-katex";
import TableOfContent from "markdown-it-toc-done-right";
import MediaPlugin from "../markdown-media";
import { once } from "../functions";
import { CachedFetcher } from "../axios-helper";
import { BlogServerOptions } from "../options";

const markdownIt = new MarkdownIt();
markdownIt.use(KaTeX);
markdownIt.use(TableOfContent);
markdownIt.use(MediaPlugin);

interface FeedContext extends ExtendableContext {
	params: { type: string };
}

export default function createFeedMiddleware(options: BlogServerOptions) {
	const { author, title } = options.app;
	const articleApi = options.contentServer.internalOrigin + "/articles";

	const getLinksFor = (origin: string) => ({
		rss: `${origin}/feed/rss`,
		json: `${origin}/feed/json`,
		atom: `${origin}/feed/atom`,
	});

	function buildFeed(response: AxiosResponse) {
		const { origin } = response.config.params;

		const feed = new Feed({
			title,
			id: origin + "/",
			link: origin + "/",
			language: "zh-CN",
			favicon: `${origin}/favicon.ico`,
			copyright: `All rights reserved 2020, ${author}`,
			feedLinks: getLinksFor(origin),
		});

		feed.items = response.data.items.map((article: any) => ({
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

		// 几个输出的结果也缓存一下，一个大约占60K内存
		feed.json1 = once(feed.json1);
		feed.rss2 = once(feed.rss2);
		feed.atom1 = once(feed.atom1);
		return feed;
	}

	// Feed 里包含了文章的内容，其需要从 Markdown 转换成 HTML 会消耗蚊子大点性能，
	// 虽然缓存这东西也没啥意义，但是既然写了个 CachedFetcher，怎么也得拿出来用用。
	const fetcher = new CachedFetcher(Axios, buildFeed, 7 * 86400 * 1000);

	return async (ctx: FeedContext) => {
		const feed = await fetcher.request({
			url: articleApi,
			params: {
				origin: ctx.origin,
				content: true,
				count: 10,
				sort: "id,DESC",
				category: ctx.query.category,
				recursive: true,
			},
		});

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
				ctx.body = { message: "请求的 Feed 类型不支持", links: getLinksFor(ctx.origin) };
		}
	};
}
