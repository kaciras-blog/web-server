import fs from "fs-extra";
import path from "path";
import { promisify } from "util";
import vuessr from "vue-server-renderer";
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

	function productionRenderFunctionFactory() {
		const renderer = vuessr.createBundleRenderer(reslove("vue-ssr-server-bundle.json"), {
			runInNewContext: false,
			template: fs.readFileSync(reslove("index.template.html"), "utf-8"),
			clientManifest: require(reslove("vue-ssr-client-manifest.json")),
		});
		return () => promisify<RenderContext, string>(renderer.renderToString);
	}

	const getRenderFunction = options.renderFunctionFactory || productionRenderFunctionFactory();

	return ctx => renderPage(ctx, getRenderFunction());
}
