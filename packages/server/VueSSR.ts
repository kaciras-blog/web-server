import { URL } from "url";
import fs from "fs-extra";
import { Context, Middleware, Request } from "koa";
import log4js from "log4js";
import path from "path";
import { BundleRenderer, createBundleRenderer } from "vue-server-renderer";
import ServerAPI from "./ServerAPI";


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

	/** 原始请求，仅用于传递用户身份信息。TODO: 下一版考虑移除，用别的方法传递 */
	request?: Context;
}

const DEFAULT_CONTEXT = {
	title: "Kaciras的博客",
	meta: "",
	shellOnly: false,
};

async function renderPage(ctx: Context, render: BundleRenderer) {
	const renderContext: RenderContext = Object.assign({}, DEFAULT_CONTEXT, {
		request: ctx,
		shellOnly: ctx.query.shellOnly,
		url: new URL(ctx.href),
	});
	try {
		ctx.body = await render.renderToString(renderContext);
	} catch (err) {
		switch (err.code) {
			case 301:
			case 302:
				ctx.status = err.code;
				ctx.redirect(err.location);
				break;
			default:
				logger.error("服务端渲染出错", err);
				const errorContext = Object.assign({}, DEFAULT_CONTEXT,
					{ url: new URL("/error/500", ctx.href) });
				ctx.status = 503;
				ctx.body = await render.renderToString(errorContext);
		}
	}
}

export interface SSRMiddlewareOptions {
	renderer: BundleRenderer | (() => BundleRenderer);
	include?: RegExp | ((request: Request) => boolean);
}

/**
 * 使用指定的渲染器和过滤规则创建服务端渲染的中间件。
 *
 * @param options 选项
 */
export function ssrMiddleware(options: SSRMiddlewareOptions): Middleware {
	const { renderer, include } = options;

	const handler: Middleware = typeof renderer !== "function"
		? (ctx) => renderPage(ctx, renderer)
		: (ctx) => renderPage(ctx, renderer());

	if (!include) {
		return handler;
	}

	const accept = typeof include === "function"
		? include
		: (request: Request) => include.test(request.path);

	return (ctx, next) => accept(ctx.request) ? handler(ctx, next) : next();
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

	return (api: ServerAPI) => api.useFallBack(ssrMiddleware({ renderer }));
}
