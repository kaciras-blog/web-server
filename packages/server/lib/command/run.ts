import log4js from "log4js";
import AppBuilder from "../AppBuilder";
import getBlogPlugin from "../blog";
import { createSSRProductionPlugin } from "../koa/vue-ssr";
import staticFiles from "../koa/static-files";
import startServer from "../create-server";
import { configureGlobalAxios } from "../axios-helper";
import { BlogServerOptions, SimpleLogConfig } from "../options";
import { combineRegexOr } from "../functions";

/**
 * 运行生产模式需要更详细的日志输出格式。
 *
 * https://log4js-node.github.io/log4js-node/appenders.html
 */
export function configureLog4js({ level, file, noConsole }: SimpleLogConfig) {
	const logConfig: log4js.Configuration = {
		appenders: {
			console: {
				type: "stdout",
				layout: {
					type: "pattern",
					pattern: "%[%d{yyyy-MM-dd hh:mm:ss} [%p] %c - %]%m",
				},
			},
		},
		categories: {
			default: { appenders: ["console"], level },
		},
	};

	if (noConsole) {
		logConfig.categories.default.appenders = [];
	}

	if (file) {
		logConfig.appenders.file = {
			type: "file",
			filename: file,
			layout: {
				type: "pattern",
				pattern: "%d{yyyy-MM-dd hh:mm:ss} [%p] %c - %m",
			},
		};
		logConfig.categories.default.appenders.push("file");
	}

	log4js.configure(logConfig);
}

export default async function run(options: BlogServerOptions) {
	configureLog4js(options.app.logging);
	const logger = log4js.getLogger();

	const closeHttp2Sessions = configureGlobalAxios(options.contentServer);

	const builder = new AppBuilder();
	builder.addPlugin(getBlogPlugin(options));
	builder.addPlugin(await createSSRProductionPlugin(options.outputDir));

	// 除了static目录外文件名都不带Hash，所以要禁用外层的缓存
	builder.useResource(staticFiles(options.outputDir, {
		staticAssets: combineRegexOr([
			new RegExp("^/favicon"),
			new RegExp("^/" + options.assetsDir),
		]),
	}));

	const app = builder.build();
	app.proxy = !!options.server.useForwardedHeaders;

	app.on("error", (err, ctx) => {
		logger.error("Error occurred on process " + ctx.path, err);
	});

	const serverGroup = await startServer(app.callback(), options.server);
	logger.info("Startup completed.");

	return () => {
		serverGroup.forceClose();
		closeHttp2Sessions();
	}
}
