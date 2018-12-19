import koaSend from "koa-send";
import { Middleware } from "koa";


/**
 * 能够发送一个位于网站内容目录下的静态文件。
 *
 * @param path 文件路径，是URL中的path部分，以/开头
 * @param options 选项
 * @return 中间件函数
 */
export function staticFile(path: string, options: any): Middleware {
	if (path.startsWith("/static/")) {
		throw new Error("静态文件目录请用 koa-static 处理");
	}
	return function (ctx, next) {
		if (ctx.path !== path) {
			return next();
		}
		if (ctx.method !== "GET") {
			ctx.status = 405;
			return Promise.resolve();
		}
		return koaSend(ctx, path, { root: options.contentRoot });
	};
}

/**
 * 拦截文件，请求Path包含在列表中将返回404。
 *
 * @param files 文件列表
 * @return Koa 的中间件函数
 */
export function intercept(files: string[]): Middleware {
	return function (ctx, next) {
		if (!files.includes(ctx.path)) {
			return next();
		}
		ctx.status = 404;
		return Promise.resolve();
	};
}
