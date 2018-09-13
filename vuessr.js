const fs = require("./asyncfs");
const send = require("koa-send");
const { promisify } = require("util");
const path = require("path");
const config = require("./config");

function reslove (file) {
	return path.join(config.content, file);
}

function productionRenderFunctionFactory () {
	const renderer = require("vue-server-renderer").createBundleRenderer(reslove("vue-ssr-server-bundle.json"), {
		runInNewContext: false,
		template: fs.readFileSync(reslove("index.template.html"), "utf-8"),
		clientManifest: require(reslove("vue-ssr-client-manifest.json")),
	});
	return () => promisify(renderer.renderToString);
}

module.exports = function createMiddleware (options) {
	options = options || {};
	const createRenderFunction = options.renderFunctionFactory
		? options.renderFunctionFactory()
		: productionRenderFunctionFactory();

	if (config.ssr.cache) {
		fs.mkdirs("cache/article");
	}
	const notFoundCache = {};

	async function renderArticlePages (ctx) {
		const context = {
			url: ctx.request.url,
		};
		try {
			ctx.body = await createRenderFunction()(context);
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
};
