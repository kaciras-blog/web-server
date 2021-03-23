import startServer from "@kaciras-blog/server/lib/create-server";
import { configureGlobalAxios } from "@kaciras-blog/server/lib/axios-helper";
import AppBuilder from "@kaciras-blog/server/lib/AppBuilder";
import getBlogPlugin from "@kaciras-blog/server/lib/blog";
import ClientConfiguration from "../config/client";
import ServerConfiguration from "../config/server";
import VueSSRHotReloader, { ClientSSRHotUpdatePlugin } from "../ssr-hot-reload";
import { ClosableMiddleware, createHotMiddleware, createKoaWebpack } from "../dev-middleware";
import { DevelopmentOptions } from "../options";

/**
 * 启动开发服务器，它提供了热重载功能。
 */
export default async function(options: DevelopmentOptions) {
	const closeHttp2Sessions = configureGlobalAxios(options.contentServer);

	const builder = new AppBuilder();
	builder.addPlugin(getBlogPlugin(options));

	const clientConfig = ClientConfiguration(options);
	clientConfig.plugins!.push(new ClientSSRHotUpdatePlugin());

	let devMiddleware: ClosableMiddleware;
	if (options.dev.useHotClient !== false) {
		devMiddleware = await createKoaWebpack(clientConfig);
	} else {
		devMiddleware = await createHotMiddleware(clientConfig);
	}
	builder.useBeforeFilter(devMiddleware);

	const vueSSRHotReloader = new VueSSRHotReloader(clientConfig, ServerConfiguration(options));
	await vueSSRHotReloader.watch();
	builder.useFallBack(vueSSRHotReloader.koaMiddleware);

	const app = builder.build();
	app.proxy = !!options.server.useForwardedHeaders;

	const serverGroup = await startServer(app.callback(), options.server);
	console.info("\n- Local URL: https://localhost/\n");

	return () => {
		vueSSRHotReloader.close();
		devMiddleware.close();
		serverGroup.forceClose();
		closeHttp2Sessions();
	};
}