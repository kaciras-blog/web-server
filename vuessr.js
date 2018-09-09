const fs = require("./asyncfs");
const send = require("koa-send");
const { promisify } = require("util");
const config = require("./config");


function createMiddleware () {
	const renderer = require("vue-server-renderer").createRenderer({
		runInNewContext: false,
		template: fs.readFileSync(config.content + "/index.template.html", "utf-8"),
		clientManifest: require(config.content + "/vue-ssr-client-manifest.json"),
	});
	const createApp = require("D:/Coding/Blog-V8/WebContent/dist/static/app.ssr").default;
	const renderToString = promisify(renderer.renderToString);

	if (config.ssr.cache) {
		fs.mkdirs("cache/article");
	}
	const notFoundCache = {};

	async function renderArticlePages (ctx) {
		const context = {
			url: ctx.request.url,
		};
		try {
			ctx.body = await renderToString(createApp(context), context);
		} catch (e) {
			if (e.code === 404) {
				ctx.response.status = 404;
			} else {
				ctx.throw(e);
			}
		}
	}

	// Markdown转换比较慢，用个缓存
	async function sendHtml (ctx) {
		if (config.ssr.cache) {
			const path = ctx.request.path;
			const cache = `cache${path}.html`;

			if (notFoundCache[path]) {
				ctx.response.status = 404;
			}
			if (await fs.existsAsync(cache)) {
				return await send(ctx, path + ".html", { root: "cache", maxage: 365 * 24 * 3600 * 1000 });
			}
			await renderArticlePages(ctx);
			if (ctx.body) {
				await fs.writeFileAsync(cache, ctx.body);
			}
		} else {
			await renderArticlePages(ctx);
		}
	}

	return function (ctx, next) {
		if (ctx.request.path.startsWith("/article")) {
			return renderArticlePages(ctx);
		} else {
			return next();
		}
	};
}

module.exports = function () {
	if (!config.ssr.enable) {
		return (ctx, next) => next();
	}
	return createMiddleware();
};
