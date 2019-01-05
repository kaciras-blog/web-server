import log4js, { Configuration, getLogger } from "log4js";
import { CliConfig } from "./index";


require("source-map-support").install();


/**
 * 配置日志功能，先于其他模块执行保证日志系统的完整。
 */
function configureLog4js ({ logLevel, logFile }: { logLevel: string, logFile: string | boolean }) {
	const logConfig: Configuration = {
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
			default: { appenders: ["console"], level: logLevel },
		},
	};
	if (logFile) {
		logConfig.appenders.file = {
			type: "file",
			filename: logFile,
			flags: "w",
			encoding: "utf-8",
			layout: {
				type: "pattern",
				pattern: "%d{yyyy-MM-dd hh:mm:ss} [%p] %c - %m",
			},
		};
		logConfig.categories.default.appenders = ["file"];
	}
	log4js.configure(logConfig);
}


configureLog4js({ logFile: false, logLevel: "info" });

// 捕获全局异常记录到日志中。
const logger = getLogger("system");
process.on("unhandledRejection", (reason, promise) => logger.error("Unhandled", reason, promise));
process.on("uncaughtException", (err) => logger.error(err.message, err.stack));


if (!process.argv[2]) {
	console.error("Configuration not specified");
	process.exit(1);
}
const config: CliConfig = require(process.argv[2]);
config.service = config.service || [];

config.service.forEach((service) => {
	const task = service.serve(config.plugins || []);
	if (task) {
		task.catch((err) => logger.error("Unhandled error:", err));
	}
});
