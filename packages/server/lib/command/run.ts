import log4js from "log4js";
import ApplicationBuilder from "../ApplicationBuilder";
import getBlogPlugin from "../blog-plugin";
import { createSSRProductionPlugin } from "../koa/vue-ssr";
import staticFiles from "../koa/static-files";
import startServer from "../create-server";
import { configureGlobalAxios } from "../helpers";
import { BlogServerOptions } from "../options";

const logger = log4js.getLogger();

export default async function run(options: BlogServerOptions) {
	const closeHttp2Sessions = configureGlobalAxios(options.contentServer);

	const builder = new ApplicationBuilder();
	builder.addPlugin(getBlogPlugin(options));
	builder.addPlugin(await createSSRProductionPlugin(options.outputDir));

	// 除了static目录外文件名都不带Hash，所以要禁用外层的缓存
	builder.useResource(staticFiles(options.outputDir, {
		staticAssets: new RegExp("^/" + options.assetsDir),
	}));

	const app = builder.build();
	app.proxy = !!options.server.useForwardedHeaders;

	app.on("error", (err, ctx) => {
		logger.error("Error occurred on process " + ctx.path, err);
	});

	const closeServer = await startServer(app.callback(), options.server);
	logger.info("Startup completed.");

	return () => {
		closeServer();
		closeHttp2Sessions();
	}
}