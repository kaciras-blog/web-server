#!/usr/bin/env node
const log4js = require("log4js");
const main = require("../lib/main");

/**
 * 配置日志功能，先于其他模块执行保证日志系统的完整。
 */
function configureLog4js ({ logLevel, logFile }) {
	const logConfig = {
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

/**
 * 捕获全局异常，将其输出到Log4js中。
 */
function redirectSystemError () {
	const logger = log4js.getLogger("system");
	process.on("unhandledRejection", (reason, promise) => logger.error("Unhandled", reason, promise));
	process.on("uncaughtException", err => logger.error(err.message, err.stack));
}


configureLog4js();
redirectSystemError();

main(process.argv.slice(2)).catch(err => {
	console.error(err);
	process.exit(1);
});
