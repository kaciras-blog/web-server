import { ParameterizedContext } from "koa";
import log4js from "log4js";
import ServerAPI from "./ServerAPI";

const logger = log4js.getLogger("CSP");

const REPORT_URI = "/csp-report";

/**
 * 设置 CSP 和 HSTS 头的中间件，能提高点安全性。
 *
 * Content-Security-Policy：
 *   frame-ancestors - 没想出有什么嵌入其它网站的必要
 *   object-src - 还是不允许往别的网站里嵌
 *   block-all-mixed-content - 我全站都是HTTPS，也不太会去用HTTP的服务
 *   其他的限制太死了，暂时没开启
 *
 * Strict-Transport-Security：直接设个最长时间就行，我的网站也不可能退回 HTTP
 *
 * TODO: 目前的配置比较简单就直接写死了，复杂了再考虑动态构建
 *
 * @param ctx Koa中间件的参数，不解释
 * @param next Koa中间件的参数，不解释
 */
async function AdvancedSecurityFilter(ctx: ParameterizedContext, next: () => Promise<any>) {
	await next();
	ctx.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
	ctx.set("Content-Security-Policy", "frame-ancestors 'self'; " +
		"object-src 'none'; block-all-mixed-content; report-uri " + REPORT_URI);
}

function CSRReportListener(ctx: ParameterizedContext, next: () => Promise<any>) {
	if (ctx.path !== REPORT_URI) {
		return next();
	}
	if (ctx.request.body) {
		logger.warn("CSP Violation: ", ctx.request.body);
	} else {
		logger.warn("CSP Violation: No data received!");
	}
	ctx.status = 204;
}

export default function installCSPPlugin(api: ServerAPI) {
	api.useResource(CSRReportListener);
	api.useBeforeAll(AdvancedSecurityFilter);
}
