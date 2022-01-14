import { URL } from "url";
import fs from "fs-extra";
import { Context } from "koa";
import log4js from "log4js";
import path from "path";
import { App } from "vue";
import { renderToString } from "@vue/server-renderer";
import AppBuilder from "../AppBuilder";

const logger = log4js.getLogger("SSR");

/** 传递给服务端入口的上下文信息，其属性可以在渲染中被修改 */
export interface RenderContext {

	/** 页面的标题 */
	title: string;

	/** 插入到页面头的一些元素 */
	meta: string;

	/** 如果路由结果为404错误页则为true */
	notFound?: boolean;

	/**
	 * 页面的完整URL，可以从中获取 origin、query 等信息，而 VueRouter 只有 path。
	 *
	 * 因为 NodeJS 的 URL 类并不在全局域，所以在这里传递以免在前端代码里 require("url")。
	 * URL 的成员类似 Location，要获取字符串形式的可以用 URL.toString()。
	 */
	url: URL;

	/** 原始请求，仅用于传递用户身份信息。 */
	request: Context;
}

type SSREntry = (context: RenderContext) => App;

const BASE_CONTEXT = {
	title: "Kaciras的博客",
	meta: "",
};

/**
 * 处理页面请求，使用指定的渲染器渲染页面，渲染结果直接写入到Koa上下文。
 *
 * 如果请求的路径不存在，则发送404错误页。
 * 页面脚本里出现的异常不会抛出，而是记录到日志，然后发送错误页面。
 *
 * @param template 渲染器
 * @param createApp 渲染器
 * @param ctx Koa上下文
 */
export async function renderPage(template: string, createApp: SSREntry, ctx: Context) {
	const renderContext: RenderContext = {
		...BASE_CONTEXT,
		request: ctx,
		url: new URL(ctx.href),
	};

	// 显式设置，虽然 Koa 内部也会用 '<' 开头来判断是否是HTML
	ctx.type = "html";

	// 流式渲染不方便在外层捕获异常，先不用
	try {
		const app = await createApp(renderContext);
		const result = await renderToString(app);

		ctx.body = template.replace("<!--vue-ssr-outlet-->", result);

		if (renderContext.notFound) {
			ctx.status = 404;
		}
	} catch (e) {
		switch (e.code) {
			case 301:
			case 302:
				ctx.status = e.code;
				ctx.redirect(e.location);
				return;
		}

		ctx.status = 503;
		// ctx.body = await render.renderToString({
		// 	...BASE_CONTEXT,
		// 	request: ctx,
		// 	url: new URL("/error/500", ctx.href),
		// });

		logger.error("服务端渲染出错", e);
	}
}

/**
 * 使用指定目录下的 vue-ssr-server-bundle.json，vue-ssr-client-manifest.json 和 index.template.html 来创建渲染器。
 *
 * @param workingDir 指定的目录
 */
export async function createSSRProductionPlugin(workingDir: string) {

	function resolve(file: string) {
		return path.resolve(workingDir, file);
	}

	const template = await fs.readFile(resolve("index.template.html"), { encoding: "utf-8" });
	// const manifest = require(resolve("ssr-manifest.json"));
	const createApp = require(resolve("entry-server.js"));

	return (api: AppBuilder) => api.useFallBack((ctx) => renderPage(template, createApp, ctx));
}
