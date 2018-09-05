const axios = require("axios");
const fs = require("fs");
const send = require('koa-send');
const { promisify } = require('util');
const config = require("./config");
const renderer = require('vue-server-renderer').createRenderer({
	template: fs.readFileSync(config.content + "/index.template.html", 'utf-8')
});
const createApp = require('D:/Coding/Blog-V8/WebContent/dist/static/app.ssr').default;

const renderToString = promisify(renderer.renderToString);

async function renderArticlePages(ctx) {
	const context = {
		url: ctx.request.url
	};
	const app = await createApp(context);

	try {
		ctx.body = await renderToString(app);
	} catch (e) {
		if (e.code === 404) {
			ctx.response.status = 404;
		} else {
			ctx.response.status = 500;
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
