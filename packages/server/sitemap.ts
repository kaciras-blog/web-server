import axios from "axios";
import { Middleware } from "koa";
import log4js from "log4js";
import { createSitemap, Sitemap, EnumChangefreq } from "sitemap";

const logger = log4js.getLogger();

/** 文章列表响应的一部分字段 */
interface ArticlePreview {
	id: number;
	urlTitle: string;
	update: string;  // yyyy-MM-dd HH:mm
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
			params: {
				count: 20,
				sort: "update_time",
				desc: true,
			},
		});

		if (response.status !== 200) {
			throw new Error("Api server response status: " + response.status);
		}

		for (const article of response.data.items as ArticlePreview[]) {

			// TODO: 在后端格式化了日期是一个设计失误
			const parts = article.update.split(/[- :]/g);
			const date = new Date(
				parseInt(parts[0]),
				parseInt(parts[1]) - 1,
				parseInt(parts[2]),
				parseInt(parts[3]),
				parseInt(parts[4]));

			sitemap.add({
				url: `/article/${article.id}/${article.urlTitle}`,
				priority: 0.5,
				changefreq: EnumChangefreq.MONTHLY,
				lastmod: date.toISOString().split(".")[0] + "Z",
			});
		}
	}
}

/** 由资源集合构建 sitemap.xml 的内容 */
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
	let cached: string;

	const resources: ArticleCollection[] = [];
	resources.push(new ArticleCollection(serverAddress));

	function updateCache() {
		buildSitemap(resources)
			.then((sitemap) => cached = sitemap)
			.catch((err) => logger.error("创建站点地图失败：", err.message));
	}

	updateCache(); // 启动时先创建一个存着

	return function handle(ctx, next) {
		if (ctx.path !== "/sitemap.xml") {
			return next();
		}
		updateCache();
		if (cached == null) {
			ctx.status = 404;
		} else {
			ctx.type = "application/xml; charset=utf-8";
			ctx.body = cached;
		}
	};
}
