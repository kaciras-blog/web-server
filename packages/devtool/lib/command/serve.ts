import { readFileSync } from "fs";
import { Middleware } from "koa";
import { createServer, ViteDevServer } from "vite";
import startServer from "@kaciras-blog/server/lib/create-server.js";
import { configureGlobalAxios } from "@kaciras-blog/server/lib/axios-helper.js";
import AppBuilder from "@kaciras-blog/server/lib/AppBuilder.js";
import { renderPage } from "@kaciras-blog/server/lib/koa/vue-ssr.js";
import getBlogPlugin from "@kaciras-blog/server/lib/blog.js";
import getViteConfig from "../build-config.js";
import { ResolvedDevConfig } from "../options.js";

function devSSR(options: ResolvedDevConfig, vite: ViteDevServer): Middleware {
	let template = readFileSync("index.html", "utf-8");

	const manifest = options.build.mode === "production"
		? // @ts-ignore
		require("./dist/client/ssr-manifest.json")
		: {};

	return async (ctx) => {
		template = await vite.transformIndexHtml(ctx.href, template);
		const ssrEntry = await vite.ssrLoadModule("/src/entry-server.ts");

		await renderPage(template, ssrEntry.default, manifest, ctx);
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

	builder.useBeforeFilter((ctx, next) => {
		vite.middlewares.handle(ctx.req, ctx.res, next);
	});
	builder.addPlugin(getBlogPlugin(options));
	builder.useFallBack(devSSR(options, vite));

	const app = builder.build();
	app.proxy = !!options.server.useForwardedHeaders;

	const serverGroup = await startServer(app.callback(), options.server);
	console.info("\n- Local URL: https://localhost/\n");

	return () => {
		vite.close();
		serverGroup.forceClose();
		closeHttp2Sessions();
	};
}
