import log4js from "log4js";
import fs from "fs-extra";
import Axios from "axios";
import { configureAxiosHttp2 } from "./axios-helper";
import { SimpleLogConfig } from "./options";

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
 * 配置全局Axios实例的便捷函数。
 *
 * @param origin Http2连接的源URL
 * @param trusted 信任的证书，或是true忽略证书检查
 */
export async function configureGlobalAxios(origin: string, trusted?: string | true) {
	const https = origin.startsWith("https");

	if (typeof trusted === "string") {
		const ca = await fs.readFile(trusted);
		return configureAxiosHttp2(Axios, https, { ca });
	} else {
		if (trusted) {
			process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
		}
		return configureAxiosHttp2(Axios, https);
	}
}
