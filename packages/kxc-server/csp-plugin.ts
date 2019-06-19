import { ParameterizedContext } from "koa";
import log4js from "log4js";
import ServerAPI from "./infra/ServerAPI";

const logger = log4js.getLogger();

const REPORT_URI = "/csp-report";

// 目前的配置比较简单就直接写死了，复杂了再考虑动态构建
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

export default function (api: ServerAPI) {
	api.useResource(CSRReportListener);
	api.useBeforeAll(AdvancedSecurityFilter);
}
