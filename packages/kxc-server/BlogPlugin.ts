import cors, { Options as CorsOptions } from "@koa/cors";
import compress from "koa-compress";
import conditional from "koa-conditional-get";
import etag from "koa-etag";
import { createImageMiddleware, ImageMiddlewareOptions } from "./image-store";
import ServerAPI, { ClassCliServerPligun } from "./infra/ServerAPI";
import { intercept, serviceWorkerToggle } from "./infra/middlewares";
import { createSitemapMiddleware } from "./sitemap";
import multer = require("koa-multer");
import { ParameterizedContext } from "koa";
import log4js from "log4js";
import bodyParser from "koa-bodyparser";

const logger = log4js.getLogger();


export interface AppOptions extends ImageMiddlewareOptions {
	cors?: CorsOptions;
	serverAddress: string;
	serverCert: string;
}

async function AdvancedSecurityFilter(ctx: ParameterizedContext, next: () => Promise<any>) {
	await next();
	ctx.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
	ctx.set("Content-Security-Policy", "frame-ancestors 'self'; " +
		"object-src 'none'; block-all-mixed-content; report-uri /csp-report");
}

function CSRReportListener(ctx: ParameterizedContext, next: () => Promise<any>) {
	if (ctx.path !== "/csp-report") {
		return next();
	}
	if (ctx.request.body) {
		logger.warn("CSP Violation: ", ctx.request.body);
	} else {
		logger.warn("CSP Violation: No data received!");
	}
	ctx.status = 204;
}

export default class BlogPlugin implements ClassCliServerPligun {

	private readonly options: AppOptions;

	constructor(options: AppOptions) {
		this.options = options;
	}

	configureCliServer(api: ServerAPI) {
		const { options } = this;

		api.useBeforeAll(AdvancedSecurityFilter);
		api.useBeforeAll(conditional());
		api.useBeforeAll(cors(options.cors));
		api.useBeforeAll(bodyParser());

		const uploader = multer({ limits: { fileSize: 4 * 1024 * 1024 } });
		api.useBeforeAll(uploader.single("file"));

		api.useBeforeFilter(serviceWorkerToggle(true));
		api.useBeforeFilter(createImageMiddleware(options)); // 图片太大不计算etag
		api.useBeforeFilter(CSRReportListener);

		api.useFilter(intercept(/\.(?:js|css)\.map$/));
		api.useFilter(compress({ threshold: 1024 }));
		api.useFilter(etag());

		api.useResource(createSitemapMiddleware(options.serverAddress));
	}
}
