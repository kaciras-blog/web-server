import axios from "axios";
import { Middleware } from "koa";
import log4js from "log4js";
import { createSitemap, EnumChangefreq, Sitemap } from "sitemap";

const logger = log4js.getLogger();

/**
 * 需要展示在站点地图里的资源，每个资源可包含多个项目。
 */
interface SitemapResource {

	/**
	 * 将该资源里的项目加入到站点地图里。
	 *
	 * @param sitemap 站点地图
	 */
	addItems(sitemap: Sitemap): Promise<void>;
}

/** 文章列表响应的一部分字段 */
interface ArticlePreview {
	id: number;
	urlTitle: string;
	update: number;
}

class ArticleCollection implements SitemapResource {

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

/**
 * 由需要展示在站点地图里的资源集合构建站点地图。
 *
 * @param resources 资源集合
 * @param isForBaidu 是否符合百度格式
 */
async function buildSitemap(resources: SitemapResource[], isForBaidu: boolean) {
	const sitemap = createSitemap({
		hostname: "https://blog.kaciras.net",
		lastmodDateOnly: isForBaidu,
	});
	for (const res of resources) {
		await res.addItems(sitemap);
	}
	return sitemap.toXML(process.env.NODE_ENV !== "production");
}

export function createSitemapMiddleware(serverAddress: string): Middleware {
	const resources = [
		new ArticleCollection(serverAddress),
	];

	return async (ctx, next) => {
		if (ctx.path !== "/sitemap.xml") {
			return next();
		}

		// https://ziyuan.baidu.com/wiki/640 百度 SiteMap 的日期格式与通用的有些不同
		const isForBaidu = ctx.query.type === "baidu"
			|| ctx.get("user-agent").indexOf("Baidu") >= 0;

		try {
			ctx.type = "application/xml; charset=utf-8";
			ctx.body = await buildSitemap(resources, isForBaidu);
		} catch (e) {
			ctx.status = 503;
			logger.error("创建站点地图失败：", e.message, e);
		}
	};
}
