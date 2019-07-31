import axios from "axios";
import { Middleware } from "koa";
import { getLogger } from "log4js";
import xml2js from "xml2js";

const logger = getLogger("Blog");

/** 文章列表响应的一部分字段 */
interface ArticlePreview {
	id: number;
	urlTitle: string;
	update: string;  // 格式：yyyy-MM-dd HH:mm
}

class ArticleCollection {

	public static convert(art: ArticlePreview) {
		const parts = art.update.split(/[- :]/g);
		const date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1,
			parseInt(parts[2]), parseInt(parts[3]), parseInt(parts[4]));

		return {
			loc: `https://blog.kaciras.net/article/${art.id}/${art.urlTitle}`,
			changefreq: "monthly",
			lastmod: date.toISOString().split(".")[0] + "Z",
			priority: 0.5,
		};
	}

	private readonly urlPrefix: string;

	/**
	 * 创建一个文章集合，从指定的服务器上获取文章列表。
	 *
	 * @param urlPrefix 后端服务器URL前缀
	 */
	constructor(urlPrefix: string) {
		this.urlPrefix = urlPrefix;
	}

	public async getItems() {
		const res = await axios.get(this.urlPrefix + "/articles", {
			params: {
				count: 20,
				sort: "update_time",
				desc: true,
			},
		});
		if (res.status !== 200) {
			throw new Error("Api server response status: " + res.status);
		}
		return res.data.items.map(ArticleCollection.convert);
	}
}


/** 由资源集合构建 sitemap.xml 的内容 */
async function buildSitemap(resources: ArticleCollection[]) {
	const sitemapBuilder = new xml2js.Builder({
		rootName: "urlset",
		xmldec: { version: "1.0", encoding: "UTF-8" },
	});

	const urlset: string[] = [];
	for (const res of resources) {
		urlset.push.apply(urlset, await res.getItems());
	}

	return sitemapBuilder.buildObject(urlset.map((item) => ({ url: item })));
}

export function createSitemapMiddleware(serverAddress: string): Middleware {
	let cached: string;

	const resources: ArticleCollection[] = [];
	resources.push(new ArticleCollection(serverAddress));

	function updateCache() {
		buildSitemap(resources)
			.then((siteMap) => cached = siteMap)
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
