import { URL } from "url";
import fs from "fs-extra";
import { Context } from "koa";
import log4js from "log4js";
import path from "path";
import { BundleRenderer, createBundleRenderer } from "vue-server-renderer";
import AppBuilder from "../AppBuilder";

const logger = log4js.getLogger("SSR");

/**
 * getPreloadFiles() 返回的数组元素，连个类型定义都没有还要我自己写。
 * 恕我直言 Vue2 我真的垃圾！
 */
interface PreloadFile {
	asType: string;
	file: string;
	extension: string;
	fileWithoutQuery: string;
}

/** 传递给服务端入口的上下文信息，其属性可以在渲染中被修改 */
export interface RenderContext {

	/** 页面的标题 */
	title: string;

	/** 插入到页面头的一些元素 */
	meta: string;

	/** 如果路由结果为404错误页则为true */
	notFound?: boolean;

	/**
	 * 页面的完整URL，可以从中获取origin、protocol、query等信息，而VueRouter只有path。
	 *
	 * 因为 NodeJS 的 URL 类并不在全局域，所以在这里传递以免在前端代码里 require("url")。
	 * URL 的成员类似 Location，要获取字符串形式的可以用 URL.toString()。
	 */
	url: URL;

	/** 原始请求，仅用于传递用户身份信息。 */
	request: Context;
}

/**
 * 由 renderToXXX 处理后的渲染上下文，注入了页面相关的属性和方法。
 */
interface ProcessedContext extends RenderContext {

	/**
	 * 这是 Vue 内置的方法，同样没有 TS 的类型定义。
	 * https://ssr.vuejs.org/guide/build-config.html#manual-asset-injection
	 */
	getPreloadFiles(): PreloadFile[];
}

function renderCommonStyle(this: ProcessedContext) {
	return this.getPreloadFiles()
		.filter(asset => asset.asType === "style")
		.map(asset => `<link rel=stylesheet href="/${asset.file}">`)
		.join("");
}

const BASE_CONTEXT = {
	title: "Kaciras的博客",
	meta: "",
	renderCommonStyle,
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
		...BASE_CONTEXT,
		request: ctx,
		url: new URL(ctx.href),
	};

	// 显式设置，虽然Koa内部也会用 '<' 开头来判断是否是HTML
	ctx.type = "html";

	try {
		ctx.body = await render.renderToString(renderContext);

		if (renderContext.notFound) {
			ctx.status = 404; // 懒得管是返回页面还是空响应体了
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
		ctx.body = await render.renderToString({
			...BASE_CONTEXT,
			request: ctx,
			url: new URL("/error/500", ctx.href),
		});

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

	const renderer = createBundleRenderer(resolve("vue-ssr-server-bundle.json"), {
		runInNewContext: false,
		inject: false,
		template: await fs.readFile(resolve("index.template.html"), { encoding: "utf-8" }),
		clientManifest: require(resolve("vue-ssr-client-manifest.json")),
	});

	return (api: AppBuilder) => api.useFallBack((ctx) => renderPage(renderer, ctx));
}
