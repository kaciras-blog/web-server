import { Feed } from "feed";
import { FeedOptions } from "feed/lib/typings";
import { Middleware } from "koa";
import { markdown } from "@kaciras-blog/common/markdown";
import { once } from "@kaciras-blog/common/functions";
import Axios, { AxiosRequestConfig, AxiosResponse } from "axios";

/**
 * Feed里包含了文章的内容，其需要从Markdown转换成Html比较费时，所以在这里缓存一下。
 */
class CachedFetcher<T> {

	private readonly fetcher: (response: AxiosResponse) => T;

	private cached!: T;
	private lastUpdate?: Date;

	constructor(fetcher: (response: AxiosResponse) => T) {
		this.fetcher = fetcher;
	}

	async request(config: AxiosRequestConfig) {
		if (this.lastUpdate) {
			config.headers = config.headers || {};
			config.headers["If-Modified-Since"] = this.lastUpdate.toUTCString();
			config.validateStatus = (status) => status >= 200 && status < 400;
		}
		const response = await Axios.request(config);
		if (response.status === 304) {
			return this.cached;
		}
		this.lastUpdate = new Date();
		return this.cached = this.fetcher(response);
	}
}

// TODO: 这个对象可自定义的属性太多，还需考虑重新组织配置文件，暂时就这样写死
const BASE_ATTRS: FeedOptions = {
	title: "Kaciras的博客",
	description: "没有简介，自己看内容吧",
	link: "https://blog.kaciras.net",
	id: "https://blog.kaciras.net",
	language: "zh",
	favicon: "https://blog.kaciras.net/favicon.ico",
	copyright: "All rights reserved 2019, Kaciras",
	feedLinks: {
		rss: "https://blog.kaciras.net/feed/rss",
		json: "https://blog.kaciras.net/feed/json",
		atom: "https://blog.kaciras.net/feed/atom",
	},
};

export function feedMiddleware(apiServer: string): Middleware {

	function buildFeed(response: AxiosResponse) {
		const feed = new Feed(BASE_ATTRS);
		feed.items = response.data.items.map((article: any) => ({
			title: article.title,
			image: "https://blog.kaciras.net" + article.cover,
			date: new Date(article.update),
			published: new Date(article.create),
			description: article.summary,
			content: markdown.render(article.content),
			link: `https://blog.kaciras.net/article/${article.id}/${article.urlTitle}`,
		}));

		// 几个输出的结果也缓存一下，经统计一个大约占60K内存
		feed.json1 = once(feed.json1);
		feed.rss2 = once(feed.rss2);
		feed.atom1 = once(feed.atom1);
		return feed;
	}

	const fetcher = new CachedFetcher(buildFeed);

	return async (ctx, next) => {
		if (!ctx.path.startsWith("/feed/")) {
			return next();
		}
		const feed = await fetcher.request({
			url: apiServer + "/articles",
			params: { count: 10, sort: "update_time", desc: true, content: true },
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
