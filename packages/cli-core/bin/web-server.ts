#!/usr/bin/env node
import log4js, { Configuration } from "log4js";
import index from "..";

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

const optionsFile = process.argv[2];
if (!optionsFile) {
	console.error("Configuration not specified");
	process.exit(1);
}
index(require(optionsFile));
