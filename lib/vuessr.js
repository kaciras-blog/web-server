const fs = require("fs");
const { promisify } = require("util");
const path = require("path");
const config = require("../config");


function reslove (file) {
	return path.resolve(config.contentRoot, file);
}

function productionRenderFunctionFactory () {
	const renderer = require("vue-server-renderer").createBundleRenderer(reslove("vue-ssr-server-bundle.json"), {
		runInNewContext: false,
		template: fs.readFileSync(reslove("index.template.html"), "utf-8"),
		clientManifest: require(reslove("vue-ssr-client-manifest.json")),
	});
	return () => promisify(renderer.renderToString);
}

module.exports = function (options = {}) {
	const getRenderFunction = process.argv.includes("-dev")
		? options.renderFunctionFactory
		: productionRenderFunctionFactory();

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

	const regex = new RegExp("^/(?:|article|category)(?:$|[/?])");

	return function (ctx, next) {
		if (regex.test(ctx.path)) {
			return renderPage(ctx);
		}
		return next();
	};
};
