const fs = require("fs");
const { promisify } = require("util");
const path = require("path");
const vuessr = require("vue-server-renderer");


async function renderPage (ctx, render) {
	const context = {
		title: "Kaciras的博客",
		meta: "",
		shellOnly: ctx.query["shellOnly"],
		request: ctx,
	};
	try {
		ctx.body = await render(context);
	} catch (err) {
		switch (err.code) {
			case 301:
			case 302:
				ctx.status = err.code;
				ctx.redirect(err.location);
				break;
			default:
				ctx.throw(err);
		}
	}
}

module.exports = function (options) {

	function reslove (file) {
		return path.resolve(options.webpack.outputPath, file);
	}

	function productionRenderFunctionFactory () {
		const renderer = vuessr.createBundleRenderer(reslove("vue-ssr-server-bundle.json"), {
			runInNewContext: false,
			template: fs.readFileSync(reslove("index.template.html"), "utf-8"),
			clientManifest: require(reslove("vue-ssr-client-manifest.json")),
		});
		return () => promisify(renderer.renderToString);
	}

	const getRenderFunction = process.argv.includes("-dev")
		? options.renderFunctionFactory
		: productionRenderFunctionFactory();

	return ctx => renderPage(ctx, getRenderFunction());
};
