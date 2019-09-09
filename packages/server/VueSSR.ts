import fs from "fs-extra";
import { Context, Middleware, Request } from "koa";
import log4js from "log4js";
import path from "path";
import { BundleRenderer, createBundleRenderer } from "vue-server-renderer";
import ServerAPI from "./ServerAPI";

const logger = log4js.getLogger("SSR");

/** 传递给服务端入口的上下文信息 */
export interface RenderContext {
	url: string;
	title: string;
	meta: string;
	shellOnly: boolean;
	request?: Context;
}

const DEFAULT_CONTEXT = {
	title: "Kaciras的博客",
	meta: "",
	shellOnly: false,
};

async function renderPage(ctx: Context, render: BundleRenderer) {
	const context: RenderContext = Object.assign({}, DEFAULT_CONTEXT, {
		request: ctx,
		shellOnly: ctx.query.shellOnly,
		url: ctx.url,
	});
	try {
		ctx.body = await render.renderToString(context);
	} catch (err) {
		switch (err.code) {
			case 301:
			case 302:
				ctx.status = err.code;
				ctx.redirect(err.location);
				break;
			default:
				logger.error("服务端渲染出错", err);
				const errorContext = Object.assign({}, DEFAULT_CONTEXT, { url: "/error/500" });
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