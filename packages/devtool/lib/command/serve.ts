import { readFileSync } from "fs";
import { Context } from "koa";
import { createServer, ViteDevServer } from "vite";
import { AppBuilder, getBlogPlugin, renderSSR } from "@kaciras-blog/server";
import getViteConfig from "../build-config.js";
import { ResolvedDevConfig } from "../options.js";

function devSSR(options: ResolvedDevConfig, vite: ViteDevServer) {
	return async (ctx: Context) => {
		let template = readFileSync("index.html", "utf8");
		template = await vite.transformIndexHtml(ctx.href, template);
		const entry = await vite.ssrLoadModule(options.ssr!);

		try {
			await renderSSR(ctx, entry.default(template));
		} catch (e) {
			vite.ssrFixStacktrace(e);
			ctx.status = 500;
			console.log(ctx.body = e.stack, e);
		}
	};
}

/**
 * 启动开发服务器，它提供了热重载和服务端渲染功能。
 */
export default async function (options: ResolvedDevConfig, signal: AbortSignal) {
	const builder = new AppBuilder();

	const vite = await createServer({
		...getViteConfig(options, false,false),
		server: { middlewareMode: "ssr" },
	});

	builder.addPlugin(getBlogPlugin(options));

	if (options.ssr) {
		builder.useFallBack(devSSR(options, vite));
	} else {
		builder.useFallBack(async ctx => {
			const template = readFileSync("index.html", "utf8");
			ctx.body = await vite.transformIndexHtml(ctx.href, template);
		});
	}

	/*
	 * Vite 使用的 connect 中间件是回调式 API，它会同步返回导致请求提前结束，
	 * 无法作为 Koa 的中间件，只能反过来把 Koa 放在它里面。
	 */
	const app = builder.build();
	app.proxy = !!options.server.useForwardedHeaders;
	vite.middlewares.use(app.callback());

	const connector = vite.middlewares.listen(80);
	console.info("\n- Local URL: http://localhost/\n");

	signal.addEventListener("abort", () => vite.close());
	signal.addEventListener("abort", () => connector.close());
}
