const axios = require("axios");
const config = require("./config");
const renderer = require('vue-server-renderer').createRenderer({
	template: require('fs').readFileSync(config.content + "/index.template.html", 'utf-8')
});
const send = require('koa-send');
const createApp = require('D:/Coding/Blog-V8/WebContent/dist-ssr/static/js/app.3cf6d616d40f1e01bbc5').default;

async function renderArticlePages(ctx, next) {
	if (ctx.request.path.startsWith("/article")) {
		const context = {url: ctx.request.url};
		const app = await createApp(context);
		renderer.renderToString(app, (err, html) => {
			if (err) {
				if (err.code === 404) {
					ctx.response.status = 404;
				} else {
					ctx.response.status = 500;
				}
			} else {
				ctx.body = html;
			}
		})
	} else {
		await next();
	}
}

module.exports = function () {
	return renderArticlePages;
};
