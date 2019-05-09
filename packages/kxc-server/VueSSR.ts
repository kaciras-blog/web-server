import fs from "fs-extra";
import { Context, Middleware, Request } from "koa";
import log4js from "log4js";
import path from "path";
import { BundleRenderer, createBundleRenderer } from "vue-server-renderer";
import ServerAPI from "./infra/ServerAPI";

const logger = log4js.getLogger("app");


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

export function ssrMiddleware(options: SSRMiddlewareOptions): Middleware {
	const { renderer, include } = options;

	const handler: Middleware = typeof renderer !== "function"
		? (ctx) => renderPage(ctx, renderer)
		: (ctx) => renderPage(ctx, renderer());

	if (!include) {
		return handler;
	}

	const filter = typeof include === "function"
		? include
		: (request: Request) => include.test(request.path);

	return (ctx, next) => {
		if (filter(ctx.request)) {
			handler(ctx, next);
		} else {
			return next();
		}
	};
}

/**
 * 使用指定目录下的 vue-ssr-server-bundle.json，vue-ssr-client-manifest.json 和 index.template.html
 * 来创建渲染器。
 *
 * @param workingDir 指定的目录
 */
export async function createSSRProductionPlugin(workingDir: string) {

	function reslove(file: string) {
		return path.resolve(workingDir, file);
	}

	const renderer = createBundleRenderer(reslove("vue-ssr-server-bundle.json"), {
		runInNewContext: false,
		template: await fs.readFile(reslove("index.template.html"), { encoding: "utf-8" }),
		clientManifest: require(reslove("vue-ssr-client-manifest.json")),
	});

	return (api: ServerAPI) => api.useFallBack(ssrMiddleware({ renderer }));
}
