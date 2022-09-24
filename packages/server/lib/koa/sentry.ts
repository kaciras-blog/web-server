import { ExtendableContext } from "koa";
import log4js from "log4js";

const logger = log4js.getLogger("Sentry");

/**
 * 代理 Sentry 的报告请求，用于解决呗 ADBlocker 或浏览器的隐私设置屏蔽的问题。
 *
 * 比起直连，代理有一些缺点：
 * 1）没发现怎么传递 IP。
 * 2）增加了服务器的流量消耗，可能会降低蚊子肉大小的性能。
 *
 * @param dsn 跟前端的 DSN 一致，用于检查请求
 * @see https://github.com/getsentry/examples/tree/master/tunneling
 */
export default function sentryTunnel(dsn: string) {
	const { host, pathname } = new URL(dsn);
	const url = `https://${host}/api/${pathname}/envelope/`;

	return async (ctx: ExtendableContext) => {
		const envelope = ctx.request.rawBody;
		const header = JSON.parse(envelope.split("\n")[0]);

		if (header.dsn !== dsn) {
			return ctx.status = 400;
		}

		try {
			const response = await fetch(url, {
				method: "POST",
				body: envelope,
				headers: {
					"X-Forwarded-For": ctx.ip,
				},
			});
			ctx.body = await response.json();
		} catch (e) {
			ctx.body = {};
			logger.warn("无法代理请求到 Sentry", e);
		}
	};
}
