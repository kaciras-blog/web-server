import log4js from "log4js";
import fs from "fs-extra";
import Axios from "axios";
import { configureAxiosHttp2 } from "./axios-helper";
import { ContentServerOptions, SimpleLogConfig } from "./options";

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
 * 【readFileSync】
 * 因为是全局的配置，基本都是在其它代码之前调用，故没必要用异步。
 *
 * @param options 选项
 */
export function configureGlobalAxios(options: ContentServerOptions) {
	const { internalOrigin, cert } = options;
	const https = internalOrigin.startsWith("https");

	if (typeof cert === "string") {
		const ca = fs.readFileSync(cert);
		return configureAxiosHttp2(Axios, https, { ca });
	} else {
		if (cert) {
			process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
		}
		return configureAxiosHttp2(Axios, https);
	}
}
