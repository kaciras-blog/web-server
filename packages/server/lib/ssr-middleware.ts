import { URL } from "url";
import fs from "fs-extra";
import { Context } from "koa";
import log4js from "log4js";
import path from "path";
import { BundleRenderer, createBundleRenderer } from "vue-server-renderer";
import ApplicationBuilder from "./ApplicationBuilder";

const logger = log4js.getLogger("SSR");

/** 传递给服务端入口的上下文信息 */
export interface RenderContext {
	title: string;
	meta: string;
	shellOnly: boolean;

	/**
	 * 页面的完整URL，可以从中获取origin、protocol、query等信息，而VueRouter只有path。
	 *
	 * 因为 NodeJS 的 URL 类并不在全局域，所以这里给解析好了免得在前端代码里 require("url")。
	 * URL 的成员类似 Location，要获取字符串形式的可以用 URL.toString()。
	 */
	url: URL;

	/** 原始请求，仅用于传递用户身份信息。 */
	request?: Context;
}

const DEFAULT_CONTEXT = {
	title: "Kaciras的博客",
	meta: "",
	shellOnly: false,
};

/**
 * 处理页面请求，使用指定的渲染器渲染页面，渲染结果直接写入到Koa上下文。
 *
 * 如果请求的路径不存在，则发送404错误页。
 * 页面脚本里出现的异常不会抛出，而是记录到日志，然后发送错误页面。
 *
 * @param render 渲染器
 * @param ctx Koa上下文
 */
export async function renderPage(render: BundleRenderer, ctx: Context) {
	const renderContext: RenderContext = {
		...DEFAULT_CONTEXT,
		request: ctx,
		shellOnly: ctx.query.shellOnly,
		url: new URL(ctx.href),
	};

	try {
		ctx.body = await render.renderToString(renderContext);
	} catch (e) {
		switch (e.code) {
			case 301:
			case 302:
				ctx.status = e.code;
				ctx.redirect(e.location);
				return;
		}
		logger.error("服务端渲染出错", e);
		const errorContext = { ...DEFAULT_CONTEXT, url: new URL("/error/500", ctx.href) };
		ctx.status = 503;
		ctx.body = await render.renderToString(errorContext);
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

	const renderer = createBundleRenderer(resolve("vue-ssr-server-bundle.json"), {
		runInNewContext: false,
		template: await fs.readFile(resolve("index.template.html"), { encoding: "utf-8" }),
		clientManifest: require(resolve("vue-ssr-client-manifest.json")),
	});

	return (api: ApplicationBuilder) => api.useFallBack((ctx) => renderPage(renderer, ctx));
}
