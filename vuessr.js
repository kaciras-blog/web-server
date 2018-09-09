const fs = require("./asyncfs");
const send = require("koa-send");
const { promisify } = require("util");
const config = require("./config");
const renderer = require('vue-server-renderer').createRenderer({
	runInNewContext: false,
	template: fs.readFileSync(config.content + "/index.template.html", 'utf-8'),
	clientManifest: require(config.content + "/vue-ssr-client-manifest.json"),
});
const createApp = require('D:/Coding/Blog-V8/WebContent/dist/static/app.ssr').default;

const renderToString = promisify(renderer.renderToString);
fs.mkdirs("cache/article");

async function renderArticlePages(ctx) {
	// Markdown转换比较慢，用个缓存
	const cacheFile = `cache${ctx.request.path}.html`;
	if (await fs.existsAsync(cacheFile)) {
		return await send(ctx, ctx.request.path + ".html", { root: "cache", maxage: 365 * 24 * 3600 * 1000 });
	}

	const context = {
		url: ctx.request.url
	};
	const app = await createApp(context);

	try {
		ctx.body = await renderToString(app, context);
		await fs.writeFileAsync(cacheFile, ctx.body);
	} catch (e) {
		if (e.code === 404) {
			ctx.response.status = 404;
		} else {
			ctx.throw(e);
		}
	}
}

module.exports = function (ctx, next) {
	if (ctx.request.path.startsWith("/article")) {
		return renderArticlePages(ctx);
	} else {
		return next();
	}
};
