import fs from "fs-extra";
import path from "path";
import { promisify } from "util";
import { createBundleRenderer } from "vue-server-renderer";
import { Middleware, Context } from "koa";


export interface RenderContext {
	title: string;
	meta: string;
	request: Context;
	shellOnly: boolean;
}

async function renderPage(ctx: Context, render: (ctx: RenderContext) => Promise<string>) {
	const context = {
		title: "Kaciras的博客",
		meta: "",
		shellOnly: ctx.query["shellOnly"],
		request: ctx,
	};
	try {
		ctx.body = await render(context);
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

export default function (options: any): Middleware {

	function reslove(file: string) {
		return path.resolve(options.webpack.outputPath, file);
	}

	if (options.renderFunctionFactory) {
		return ctx => renderPage(ctx, options.renderFunctionFactory());
	}

	const renderer = createBundleRenderer(reslove("vue-ssr-server-bundle.json"), {
		runInNewContext: false,
		template: fs.readFileSync(reslove("index.template.html"), "utf-8"),
		clientManifest: require(reslove("vue-ssr-client-manifest.json")),
	});

	const renderFunction = promisify<RenderContext, string>(renderer.renderToString);
	return ctx => renderPage(ctx, renderFunction);
}
