const xml2js = require("xml2js");
const log = require("log4js").getLogger("app");
const axios = require("axios");


class ArticleCollection {

	constructor (urlPrefix) {
		this.urlPrefix = urlPrefix;
	}

	static convert (art) {
		const parts = art.update.split(/[- :]/g); // 原始格式：yyyy-MM-dd HH:mm
		const date = new Date(parts[0], parts[1] - 1, parts[2], parts[3], parts[4]);

		const item = {
			loc: `https://blog.kaciras.net/article/${art.id}/${art.urlTitle}`,
			changefreq: "monthly",
			lastmod: date.toISOString().split(".")[0] + "Z",
			priority: 0.5,
		};
		return { url: item };
	}

	/** 查询后台服务器，获取最新的文章列表 */
	async getItems () {
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
		return res.data.map(ArticleCollection.convert);
	}
}

let cached = null;
const resources = [];

function updateCache () {
	return buildSitemap()
		.then(siteMap => cached = siteMap)
		.catch(err => log.error("创建站点地图失败：", err.message));
}


/** 由文章列表构建 sitemap.xml 的内容 */
async function buildSitemap () {
	const sitemapBuilder = new xml2js.Builder({
		rootName: "urlset",
		xmldec: {
			version: "1.0",
			encoding: "UTF-8",
		},
	});

	const urlset = [];
	for (const res of resources) {
		urlset.push.apply(urlset, await res.getItems());
	}

	return sitemapBuilder.buildObject(urlset);
}

module.exports = function (options) {
	resources.push(new ArticleCollection(options.apiServer));

	updateCache(); // 启动时先创建一个存着

	return function handle (ctx, next) {
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
		return Promise.resolve();
	};
};
