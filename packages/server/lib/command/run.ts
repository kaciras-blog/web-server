import { BaseContext } from "koa";
import log4js from "log4js";
import AppBuilder from "../AppBuilder.js";
import getBlogPlugin from "../blog.js";
import { createSSRProductionPlugin } from "../koa/vue-ssr.js";
import staticFiles from "../koa/static-files.js";
import startServer from "../create-server.js";
import { configureGlobalAxios } from "../axios-helper.js";
import { ResolvedConfig, SimpleLogConfig } from "../config.js";

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

/**
 * /static 目录下的文件是有Hash名的，可以永久缓存，图标资源缓存的时间短点，其它不缓存。
 */
function staticFilesCacheControl(ctx: BaseContext) {
	const { path } = ctx;
	if (path.startsWith("/static/")) {
		ctx.set("Cache-Control", "public,max-age=31536000,immutable");
	} else if (/^\/(favicon|icons)/.test(path)) {
		ctx.set("Cache-Control", "public,max-age=604800,s-maxage=43200");
	}
}

export default async function run(options: ResolvedConfig) {
	configureLog4js(options.app.logging);
	const logger = log4js.getLogger();

	const closeHttp2Sessions = configureGlobalAxios(options.contentServer);

	const builder = new AppBuilder();
	builder.addPlugin(getBlogPlugin(options));
	builder.addPlugin(await createSSRProductionPlugin(options.outputDir));

	builder.useResource(staticFiles(options.outputDir, {
		customResponse: staticFilesCacheControl,
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
	};
}
