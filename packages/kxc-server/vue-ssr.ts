import { Context, Middleware, Request } from "koa";
import { BundleRenderer } from "vue-server-renderer";


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

export default function (options: SSRMiddlewareOptions): Middleware {
	const { renderer, include } = options;

	// function reslove (file: string) {
	// 	return path.resolve(options.webpack.outputPath, file);
	// }
	//
	// const renderer = createBundleRenderer(reslove("vue-ssr-server-bundle.json"), {
	// 	runInNewContext: false,
	// 	template: await fs.readFile(reslove("index.template.html"), { encoding: "utf-8" }),
	// 	clientManifest: require(reslove("vue-ssr-client-manifest.json")),
	// });

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
