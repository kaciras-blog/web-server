import { readFileSync } from "fs";
import { Middleware } from "koa";
import { createServer, ViteDevServer } from "vite";
import { configureGlobalAxios } from "@kaciras-blog/server/lib/axios-helper.js";
import AppBuilder from "@kaciras-blog/server/lib/AppBuilder.js";
import { renderPage } from "@kaciras-blog/server/lib/koa/vue-ssr.js";
import getBlogPlugin from "@kaciras-blog/server/lib/blog.js";
import getViteConfig from "../build-config.js";
import { ResolvedDevConfig } from "../options.js";

function devSSR(options: ResolvedDevConfig, vite: ViteDevServer): Middleware {
	return async (ctx) => {
		let template = readFileSync("index.html", "utf8");
		template = await vite.transformIndexHtml(ctx.href, template);
		const ssrEntry = await vite.ssrLoadModule("/src/entry-server.ts");

		await renderPage(template, ssrEntry.default, {}, ctx);
	};
}

/**
 * 启动开发服务器，它提供了热重载功能。
 */
export default async function (options: ResolvedDevConfig) {
	const closeHttp2Sessions = configureGlobalAxios(options.contentServer);
	const builder = new AppBuilder();

	const vite = await createServer({
		...getViteConfig(options),
		server: { middlewareMode: "ssr" },
	});

	builder.addPlugin(getBlogPlugin(options));
	builder.useFallBack(devSSR(options, vite));

	/*
	 * Vite 使用的 connect 中间件是回调式 API，它会同步返回导致请求提前结束，
	 * 无法作为 Koa 的中间件，只能反过来把 Koa 放在它里面。
	 */
	const app = builder.build();
	app.proxy = !!options.server.useForwardedHeaders;
	vite.middlewares.use(app.callback());

	const serverGroup = vite.middlewares.listen(80);
	console.info("\n- Local URL: https://localhost/\n");

	return () => {
		vite.close();
		serverGroup.close();
		closeHttp2Sessions();
	};
}
