const axios = require("axios");
const renderer = require('vue-server-renderer').createRenderer();
const send = require('koa-send');

async function renderArticlePages(ctx, next) {
	await next();
}

module.exports = function () {
	return renderArticlePages;
};