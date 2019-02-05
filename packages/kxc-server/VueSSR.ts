import fs from "fs-extra";
import { Context, Middleware, Request } from "koa";
import path from "path";
import { BundleRenderer, createBundleRenderer } from "vue-server-renderer";
import { CliServerPligun } from "./index";
import ServerAPI from "./ServerAPI";


export interface RenderContext {
	title: string;
	meta: string;
	request: Context;
	shellOnly: boolean;
}

async function renderPage (ctx: Context, render: BundleRenderer) {
	const context: RenderContext = {
		title: "Kaciras的博客",
		meta: "",
		shellOnly: ctx.query.shellOnly,
		request: ctx,
	};
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
				ctx.throw(err);
		}
	}
}

export interface SSRMiddlewareOptions {
	renderer: BundleRenderer | (() => BundleRenderer);
	include?: RegExp | ((request: Request) => boolean);
}

export function ssrMiddleware (options: SSRMiddlewareOptions): Middleware {
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

export default class VueSSRProductionPlugin implements CliServerPligun {

	private readonly context: string;

	constructor (context: string) {
		this.context = context;
	}

	configureCliServer (api: ServerAPI): void {
		const { context } = this;

		function reslove (file: string) {
			return path.resolve(context, file);
		}

		const renderer = createBundleRenderer(reslove("vue-ssr-server-bundle.json"), {
			runInNewContext: false,
			template: fs.readFileSync(reslove("index.template.html"), { encoding: "utf-8" }),
			clientManifest: require(reslove("vue-ssr-client-manifest.json")),
		});
		api.useFallBack(ssrMiddleware({ renderer }));
	}
}
