import webpack, { Configuration } from "webpack";
import { Middleware } from "koa";
import { NextHandleFunction } from "connect";
import koaWebpack from "koa-webpack";
import WebpackHotMiddlewareType from "webpack-hot-middleware";
import WebpackHotMiddleware from "webpack-hot-middleware";

export interface ClosableMiddleware extends Middleware {
	close(callback?: () => any): void;
}

/**
 * koaWebpack 使用 webpack-hot-client，与 webpack-hot-middleware 不同的是它使用 WebSocket 来发送
 * 更新通知。
 *
 * 两者具体的区别见：https://github.com/webpack-contrib/webpack-hot-client/issues/18
 *
 * @param config webpack的配置
 */
export function createKoaWebpack(config: Configuration) {
	try {
		require("webpack-hot-client");
	} catch (e) {
		throw new Error("You should install `webpack-hot-client`, try `npm i -D webpack-hot-client`");
	}

	if (!config.output?.publicPath) {
		throw new Error("Webpack 配置中的 output.publicPath 必须设置");
	}

	config.output.filename = "[name].js";

	/*
	 * 【坑】Firefox 默认禁止从HTTPS页面访问WS连接，又有Http2模块不存在upgrade事件导致 webpack-hot-client
	 * 无法创建 websocket。当前做法是把 Firefox 的 network.websocket.allowInsecureFromHTTPS 设为true。
	 */
	return koaWebpack({
		config,
		devMiddleware: {
			publicPath: config.output.publicPath,
			stats: "minimal",
		},
		hotClient: { logLevel: "warn" },
	});
}

/**
 * 使用 webpack-hot-middleware，webpack 官方的开发服务器也使用这个库。
 * webpack-hot-middleware 使用 Server-Sent-Event 来通知前端更新资源，兼容性比WebpackHotClient好。
 *
 * @param config webpack的配置
 * @deprecated 尽量使用上面的 createKoaWebpack
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
	const devMiddleware = require("webpack-dev-middleware")(compiler, {
		publicPath: config.output.publicPath,
		noInfo: true,
		stats: "minimal",
	});

	// 使用 TypeScript 的延迟加载，保证在调用时才会 require("webpack-hot-middleware")
	let hotMiddleware: NextHandleFunction & WebpackHotMiddleware.EventStream;
	try {
		const ctor: typeof WebpackHotMiddlewareType = require("webpack-hot-middleware");
		hotMiddleware = ctor(compiler, { heartbeat: 5000 });
	} catch (e) {
		throw new Error("You need install `webpack-hot-middleware`, try `npm i -D webpack-hot-middleware`");
	}

	// 这下面的部分参考了 koa-webpack https://github.com/shellscape/koa-webpack/blob/master/lib/middleware.js
	const middleware: Middleware = (ctx, next) => {

		// wait for webpack-dev-middleware to signal that the build is ready
		const ready = new Promise((resolve, reject) => {
			compiler.hooks.failed.tap("KoaWebpack", reject);
			devMiddleware.waitUntilValid(resolve);
		});

		const handling = new Promise((resolve) => {
			const innerNext = () => {
				hotMiddleware(ctx.req, ctx.res, () => resolve(next()));
			};
			const resAdapter = {
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
	}

	return middleware as ClosableMiddleware;
}
