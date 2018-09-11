const xml2js = require("xml2js");
const log = require("log4js").getLogger("app");
const axios = require("axios");
const config = require("./config");

let cached = null;

function updateCache () {
	getLastUpdatePosts()
		.then(siteMap => cached = siteMap)
		.catch(err => log.error("创建站点地图失败", err));
}

async function getLastUpdatePosts () {
	const res = await axios.get(config.apiServer + "/articles?sort=update_time&desc=true&count=20");
	if (res.status !== 200) {
		throw new Error();
	}
	return buildSitemap(res.data);
}

function buildSitemap (json) {
	const sitemapBuilder = new xml2js.Builder({
		rootName: "urlset",
		xmldec: {
			version: "1.0",
			encoding: "UTF-8",
		},
	});
	const urlset = [];
	for (let art of json) {
		const parts = art.update.split(/[- :]/g); // 原始格式：yyyy-MM-dd HH:mm
		const date = new Date(parts[0], parts[1] - 1, parts[2], parts[3], parts[4]);
		urlset.push({
			url: {
				loc: "https://blog.kaciras.net/article/" + art.id,
				changefreq: "monthly",
				lastmod: date.toISOString().split(".")[0] + "Z",
				priority: 0.5,
			},
		});
	}
	return sitemapBuilder.buildObject(urlset);
}

updateCache(); // 启动时先创建一个存着

module.exports = function (ctx, next) {
	if (ctx.request.path === "/sitemap.xml") {
		updateCache();
		if (cached == null) {
			ctx.status = 404;
		} else {
			ctx.type = "application/xml; charset=utf-8";
			ctx.body = cached;
		}
	} else {
		return next();
	}
};
