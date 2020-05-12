import axios from "axios";
import { BaseContext } from "koa";
import log4js from "log4js";
import { EnumChangefreq, SitemapStream, streamToPromise } from "sitemap";

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
	addItems(sitemap: SitemapStream): Promise<void>;
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

	public async addItems(sitemap: SitemapStream) {
		const response = await axios.get(this.url, {
			params: { count: 20, sort: "update_time,DESC" },
		});

		if (response.status !== 200) {
			throw new Error("Api server response status: " + response.status);
		}

		for (const article of response.data.items as ArticlePreview[]) {
			sitemap.write({
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
	const sitemap = new SitemapStream({
		hostname: "https://blog.kaciras.com",
		lastmodDateOnly: isForBaidu,
	});
	for (const res of resources) {
		await res.addItems(sitemap);
	}
	sitemap.end();
	return streamToPromise(sitemap);
}

export default function createSitemapMiddleware(serverAddress: string) {
	const resources = [
		new ArticleCollection(serverAddress),
	];

	return async (ctx: BaseContext) => {
		// https://ziyuan.baidu.com/wiki/640 百度 SiteMap 的日期格式与通用的有些不同。
		// 【注意】ctx.get() 对不存在的头返回空字符串。
		const isForBaidu = ctx.query.type === "baidu"
			|| ctx.get("user-agent").indexOf("Baidu") >= 0;

		try {
			ctx.type = "application/xml";
			ctx.body = await buildSitemap(resources, isForBaidu);
		} catch (e) {
			ctx.status = 503;
			logger.error("创建站点地图失败：", e.message, e);
		}
	};
}
