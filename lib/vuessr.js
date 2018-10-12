const fs = require("fs");
const send = require("koa-send");
const { promisify } = require("util");
const path = require("path");
const config = require("../config");
const { fileExist } = require("./utils");


const asyncfs = fs.promises;

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
	const getRenderFunction = options.renderFunctionFactory
		? options.renderFunctionFactory()
		: productionRenderFunctionFactory();

	if (config.ssr.cache) {
		fs.mkdirSync("cache/article", { recursive: true });
	}
	const notFoundCache = {};

	async function renderPage (ctx) {
		const context = {
			title: "Kaciras的博客",
			meta: "",
			request: ctx,
		};
		try {
			const render = getRenderFunction();
			ctx.body = await render(context);
		} catch (err) {
			switch (err.code) {
				case 301:
				case 302:
					ctx.status = err.code;
					ctx.redirect(err.location);
					break;
				case 404:
					ctx.status = 404;
					break;
				default:
					ctx.throw(err);
			}
		}
	}

	// Markdown转换比较慢，用个缓存
	async function sendHtml (ctx) {
		if (config.ssr.cache) {
			const cache = `cache${ctx.path}.html`;

			if (notFoundCache[ctx.path]) {
				ctx.status = 404;
			}
			if (await fileExist(cache)) {
				return await send(ctx, ctx.path + ".html", { root: "cache", maxage: config.cacheMaxAge });
			}
			await renderPage(ctx);
			if (ctx.body) {
				await asyncfs.writeFile(cache, ctx.body);
			}
		} else {
			await renderPage(ctx);
		}
	}

	const regex = new RegExp("^/(?:|article|category)(?:$|[/?])");

	return function (ctx, next) {
		if (regex.test(ctx.path)) {
			return renderPage(ctx);
		} else {
			return next();
		}
	};
};
