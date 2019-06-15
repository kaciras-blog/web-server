/*
 * Webpack 热更新的 Koa 中间件，webpack-hot-middleware 和 koa-webpack 都支持
 */
import path from "path";
import webpack, { Configuration } from "webpack";
import { Context } from "koa";
import { NextHandleFunction } from "connect";
import { Middleware } from "koa";
import koaWebpack from "koa-webpack";
import WebpackHotMiddlewareType from "webpack-hot-middleware";


/**
 * koaWebpack 使用 webpack-hot-client，与 webpack-hot-middleware 不同的是它使用 WebSocket 来发送
 * 更新通知。
 *
 * 两者具体的区别见：https://github.com/webpack-contrib/webpack-hot-client/issues/18
 *
 * @param config webpack的配置
 */
async function createKoaWebpack(config: any) {
	try {
		require("webpack-hot-client");
	} catch (e) {
		throw new Error("You should install `webpack-hot-client`, try `npm i -D webpack-hot-client`");
	}

	config.output.filename = "[name].js";

	/*
	 * 【坑】Firefox 默认禁止从HTTPS页面访问WS连接，又有Http2模块不存在upgrade事件导致 webpack-hot-client
	 * 无法创建 websocket。当前做法是关闭 Firefox 的 network.websocket.allowInsecureFromHTTPS 设为true。
	 */
	return await koaWebpack({
		compiler: webpack(config),
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
 */
async function createHotMiddleware(config: any) {
	if (!config.entry) {
		throw new Error("No entry specified.");
	}
	if (!Array.isArray(config.entry)) {
		config.entry = [config.entry];
	}

	config.entry.unshift("webpack-hot-middleware/client");
	config.output.filename = "[name].js";
	config.plugins.push(new webpack.HotModuleReplacementPlugin());

	const compiler = webpack(config);
	const devMiddleware = require("webpack-dev-middleware")(compiler, {
		publicPath: config.output.publicPath,
		noInfo: true,
		stats: "minimal",
	});

	// 使用 TypeScript 的延迟加载，保证在调用时才会 require("webpack-hot-middleware")
	let hotMiddleware: NextHandleFunction;
	try {
		const WebpackHotMiddleware: typeof WebpackHotMiddlewareType = require("webpack-hot-middleware");
		hotMiddleware = WebpackHotMiddleware(compiler, { heartbeat: 5000 });
	} catch (e) {
		throw new Error("You need install `webpack-hot-middleware`, try `npm i -D webpack-hot-middleware`");
	}

	return (ctx: Context, next: () => Promise<any>) => {
		const innerNext = () => {
			return new Promise((resolve) => hotMiddleware(ctx.req, ctx.res, () => resolve(next())));
		};

		// wait for webpack-dev-middleware to signal that the build is ready
		return Promise.all([
			new Promise((resolve, reject) => {
				compiler.hooks.failed.tap("KoaWebpack", reject);
				devMiddleware.waitUntilValid(() => resolve(true));
			}),
			new Promise((resolve) => {
				const resAdapter = {
					end: (content: any) => {
						ctx.body = content;
						resolve();
					},
					setHeader: ctx.set.bind(ctx),
					getHeader: ctx.get.bind(ctx),
					locals: ctx.state,
				};

				// devMiddleware 里只用了上面那几个属性，这里直接强制转换了
				devMiddleware(ctx.req, resAdapter, () => resolve(innerNext()));
			}),
		]);
	};
}

export default function(useHotClient: boolean, webpackConfig: Configuration): Promise<Middleware> {
	// 添加当前工作目录到模块路径中，在使用 npm link 本地安装时需要。
	process.env.NODE_PATH = path.resolve("node_modules");
	require("module").Module._initPaths();

	return useHotClient ? createKoaWebpack(webpackConfig) : createHotMiddleware(webpackConfig);
}
