import axios from "axios";
import { Middleware } from "koa";
import log4js from "log4js";
import { createSitemap, EnumChangefreq, Sitemap } from "sitemap";

const logger = log4js.getLogger();

/** 文章列表响应的一部分字段 */
interface ArticlePreview {
	id: number;
	urlTitle: string;
	update: number;
}

class ArticleCollection {

	private readonly url: string;

	/**
	 * 创建一个文章集合，从指定的服务器上获取文章列表。
	 *
	 * @param urlPrefix 后端服务器URL前缀
	 */
	constructor(urlPrefix: string) {
		this.url = urlPrefix + "/articles";
	}

	public async addItems(sitemap: Sitemap) {
		const response = await axios.get(this.url, {
			params: { count: 20, sort: "update_time", desc: true },
		});

		if (response.status !== 200) {
			throw new Error("Api server response status: " + response.status);
		}

		for (const article of response.data.items as ArticlePreview[]) {
			sitemap.add({
				url: `/article/${article.id}/${article.urlTitle}`,
				priority: 1.0,
				changefreq: EnumChangefreq.MONTHLY,
				lastmod: new Date(article.update).toISOString(),
			});
		}
	}
}

async function buildSitemap(resources: ArticleCollection[]) {
	const sitemap = createSitemap({
		hostname: "https://blog.kaciras.net",
	});
	for (const res of resources) {
		await res.addItems(sitemap);
	}
	return sitemap.toXML(process.env.NODE_ENV !== "production");
}

export function createSitemapMiddleware(serverAddress: string): Middleware {
	let lastBuilt: string;

	const resources: ArticleCollection[] = [];
	resources.push(new ArticleCollection(serverAddress));

	function getSitemap() {
		return buildSitemap(resources).then((sitemap) => lastBuilt = sitemap)
			.catch((err) => logger.error("创建站点地图失败：", err.message));
	}

	// noinspection JSIgnoredPromiseFromCall 启动时先创建一个
	getSitemap();

	return async function handle(ctx, next) {
		if (ctx.path !== "/sitemap.xml") {
			return next();
		}
		logger.info("客户端请求了SiteMap");

		if (lastBuilt == null) {
			ctx.status = 404;
		} else {
			ctx.type = "application/xml; charset=utf-8";
			ctx.body = await getSitemap();
		}
	};
}
