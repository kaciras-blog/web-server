import { Context, Middleware } from "koa";
import { BundleRenderer } from "vue-server-renderer";


export interface RenderContext {
	title: string;
	meta: string;
	request: Context;
	shellOnly: boolean;
}

async function renderPage (ctx: Context, render: BundleRenderer) {
	const context = {
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

export default function (renderer: BundleRenderer | (() => BundleRenderer)): Middleware {

	// function reslove (file: string) {
	// 	return path.resolve(options.webpack.outputPath, file);
	// }
	//
	// const renderer = createBundleRenderer(reslove("vue-ssr-server-bundle.json"), {
	// 	runInNewContext: false,
	// 	template: await fs.readFile(reslove("index.template.html"), { encoding: "utf-8" }),
	// 	clientManifest: require(reslove("vue-ssr-client-manifest.json")),
	// });

	if (typeof renderer !== "function") {
		return (ctx) => renderPage(ctx, renderer);
	}
	return (ctx) => renderPage(ctx, renderer());
}
