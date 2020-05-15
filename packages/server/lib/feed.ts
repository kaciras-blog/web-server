import Axios, { AxiosResponse } from "axios";
import { Feed } from "feed";
import { FeedOptions } from "feed/lib/typings";
import { Middleware } from "koa";
import MarkdownIt from "markdown-it";
import KaTeX from "@iktakahiro/markdown-it-katex";
import TableOfContent from "markdown-it-toc-done-right";
import MediaPlugin from "../lib/markdown-media";
import { once } from "./functions";
import { CachedFetcher } from "./axios-helper";

export const markdown = new MarkdownIt();

markdown.use(KaTeX);
markdown.use(TableOfContent);
markdown.use(MediaPlugin);

export function feedMiddleware(apiServer: string): Middleware {

	const origin = "https://blog.kaciras.com";

	// TODO: 这个对象可自定义的属性太多，还需考虑重新组织配置文件，暂时这样写死
	// TODO: 分类字段
	const BASE_ATTRS: FeedOptions = {
		title: "Kaciras的博客",
		description: "没有简介，自己看内容吧",
		link: origin,
		id: origin,
		language: "zh",
		favicon: `${origin}/favicon.ico`,
		copyright: "All rights reserved 2020, Kaciras",
		feedLinks: {
			rss: `${origin}/feed/rss`,
			json: `${origin}/feed/json`,
			atom: `${origin}/feed/atom`,
		},
	};

	function buildFeed(response: AxiosResponse) {
		const feed = new Feed(BASE_ATTRS);

		feed.items = response.data.items.map((article: any) => ({
			title: article.title,
			image: origin + article.cover,
			date: new Date(article.update),
			published: new Date(article.create),
			description: article.summary,
			content: markdown.render(article.content),
			link: `${origin}/article/${article.id}/${article.urlTitle}`,
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

	return async (ctx, next) => {
		if (!ctx.path.startsWith("/feed/")) {
			return next();
		}
		if (ctx.method !== "GET") {
			return ctx.status = 405;
		}

		const feed = await fetcher.request({
			url: apiServer + "/articles",
			params: {
				content: true,
				count: 10,
				sort: "id,DESC",
				category: ctx.query.category,
				recursive: true,
			},
		});

		switch (ctx.path.substring(6)) {
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
				ctx.body = { message: "请求的Feed类型不支持", links: BASE_ATTRS.feedLinks };
		}
	};
}
