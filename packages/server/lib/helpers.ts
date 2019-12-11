import log4js from "log4js";
import fs from "fs-extra";
import Axios from "axios";
import { configureAxiosHttp2 } from "./axios-helper";

interface SimpleLogConfig {
	level: string;
	file?: string;

	/**
	 * 即使用了文件日志，还是保持控制台输出，使用此选项可以关闭控制台的输出。
	 * 【注意】很多日志处理系统默认读取标准流，所以不建议关闭。
	 */
	noConsole?: boolean;
}

/**
 * 简单地配置一下日志，文档见：
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
			flags: "w",
			encoding: "utf-8",
			layout: {
				type: "pattern",
				pattern: "%d{yyyy-MM-dd hh:mm:ss} [%p] %c - %m",
			},
		};
		logConfig.categories.default.appenders.push("file");
	}
	log4js.configure(logConfig);
}
