import webpack, { Configuration } from "webpack";
import { Middleware } from "koa";
import newDevMiddleware from "webpack-dev-middleware";
import newHotMiddleware from "webpack-hot-middleware";

export interface ClosableMiddleware extends Middleware {
	close(callback?: () => any): void;
}

/**
 * 使用 webpack-hot-middleware，webpack 官方的开发服务器也使用这个库。
 * webpack-hot-middleware 使用 Server-Sent-Event 来通知前端更新资源，兼容性比WebpackHotClient好。
 *
 * @param config webpack的配置
 */
export async function createHotMiddleware(config: Configuration) {
	if (!config.entry) {
		throw new Error("No entry specified.");
	}
	if (!config.output?.publicPath) {
		throw new Error("Webpack 配置中的 output.publicPath 必须设置");
	}

	// TODO: config.entry 情况太复杂，但目前项目里只有string[]
	if (!Array.isArray(config.entry)) {
		config.entry = [config.entry as string];
	}

	config.entry.unshift("webpack-hot-middleware/client");
	config.output.filename = "[name].js";
	config.plugins!.push(new webpack.HotModuleReplacementPlugin());

	const compiler = webpack(config);
	const devMiddleware = newDevMiddleware(compiler, {
		stats: "minimal",
		publicPath: config.output.publicPath as string,
	});

	// @ts-ignore 这个库的类型没跟上
	const hotMiddleware = newHotMiddleware(compiler, { heartbeat: 5000 });

	// 这下面的部分参考了 koa-webpack https://github.com/shellscape/koa-webpack/blob/master/lib/middleware.js
	const middleware: Middleware = (ctx, next) => {

		// wait for webpack-dev-middleware to signal that the build is ready
		const ready = new Promise((resolve, reject) => {
			compiler.hooks.failed.tap("KoaWebpack", reject);
			devMiddleware.waitUntilValid(resolve);
		});

		const handling = new Promise<void>((resolve) => {
			const innerNext = () => {
				hotMiddleware(ctx.req, ctx.res, () => resolve(next()));
			};
			const resAdapter: any = {
				end: (content: any) => {
					resolve();
					ctx.body = content;
				},
				setHeader: ctx.set.bind(ctx),
				getHeader: ctx.get.bind(ctx),
				locals: ctx.state,
			};
			devMiddleware(ctx.req, resAdapter, innerNext);
		});

		return Promise.all([ready, handling]);
	};

	(middleware as ClosableMiddleware).close = () => {
		devMiddleware.close();
		hotMiddleware.close();
	};

	return middleware as ClosableMiddleware;
}
