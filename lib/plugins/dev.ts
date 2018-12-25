import path from "path";
import koaWebpack from "koa-webpack";
import webpack, { Compiler, Configuration, MultiCompiler } from "webpack";
import { Context, Middleware } from "koa";
import { WebpackDevMiddleware } from "webpack-dev-middleware";
import WebpackHotMiddlewareType from "webpack-hot-middleware";
import { NextHandleFunction } from "connect";
import { ServerResponse } from "http";
import ClientConfiguration from "../template/client.config";


abstract class AbstractDevelopPlugin {



	middleware!: Middleware;
	private config: webpack.Configuration;

	constructor(config: Configuration) {
		this.config = config;
	}

	async initilize() {
		return this.initClientCompiler(this.config);
	}

	abstract async initClientCompiler(config: Configuration): Promise<void>;
}


class KoaWebpackDevelopPlugin extends AbstractDevelopPlugin {

	async initClientCompiler(config: any) {
		try {
			require("webpack-hot-client");
		} catch (e) {
			throw new Error("You should install `webpack-hot-client`, try `npm i -D webpack-hot-client`");
		}

		const clientCompiler = webpack(config);
		config.output.filename = "[name].js";

		/*
		 * 此处有一坑，Firefox默认禁止从HTTPS页面访问WS连接，又有Http2模块不存在upgrade事件导致
		 * webpack-hot-client 无法创建 websocket。
		 * 当前做法是关闭Firefox的 network.websocket.allowInsecureFromHTTPS 设为true。
		 */
		this.middleware = await koaWebpack({ compiler: clientCompiler });
	}
}

interface ExtResponse extends ServerResponse {
	locals: any;
}

class HotMiddlewareDevemopPlugin extends AbstractDevelopPlugin {

	private clientCompiler!: Compiler | MultiCompiler;
	private devMiddleware!: WebpackDevMiddleware & NextHandleFunction;
	private hotMiddleware: any;

	async initClientCompiler(config: any) {
		if (!Array.isArray(config.entry)) {
			config.entry = [config.entry];
		}
		config.entry.unshift("webpack-hot-middleware/client");
		config.output.filename = "[name].js";
		config.plugins.push(new webpack.HotModuleReplacementPlugin());

		// dev middleware
		const clientCompiler = webpack(config);
		const devMiddleware = require("webpack-dev-middleware")(clientCompiler, {
			publicPath: config.output.publicPath,
			noInfo: true,
			stats: "minimal",
		});

		this.clientCompiler = clientCompiler;
		this.devMiddleware = devMiddleware;

		try {
			const WebpackHotMiddleware: typeof WebpackHotMiddlewareType = require("webpack-hot-middleware");
			this.hotMiddleware = WebpackHotMiddleware(clientCompiler, { heartbeat: 5000 });
		} catch (e) {
			throw new Error("You should install `webpack-hot-middleware`, try `npm i -D webpack-hot-middleware`");
		}

		this.middleware = this._middleware.bind(this);
	}

	_middleware(ctx: Context, next: () => Promise<any>) {
		const innerNext = () => {
			return new Promise(resolve => this.hotMiddleware(ctx.req, ctx.res, () => resolve(next())));
		};

		// wait for webpack-dev-middleware to signal that the build is ready
		return Promise.all([
			new Promise((resolve, reject) => {
				let comps: Compiler[];
				if (this.clientCompiler instanceof Compiler) {
					comps = [this.clientCompiler]
				} else {
					comps = this.clientCompiler.compilers;
				}
				comps.forEach(c => c.hooks.failed.tap("KoaWebpack", reject));
				this.devMiddleware.waitUntilValid(() => resolve(true));
			}),
			new Promise((resolve) => {
				const resAdapter = {
					end: (content: any) => {
						ctx.body = content;
						resolve();
					},
					setHeader: ctx.set.bind(ctx),
					locals: ctx.state,
				};

				// devMiddleware 里只用了上面那几个属性，这里直接强制转换了
				this.devMiddleware(ctx.req, <ExtResponse>resAdapter, () => resolve(innerNext()));
			}),
		]);
	}
}

export default function (options: any, webpackConfig: Configuration) {
	// 添加当前工作目录到模块路径中，在使用 npm link 本地安装时需要。
	process.env.NODE_PATH = path.resolve("node_modules");
	require("module").Module._initPaths();

	const MiddlewareClass = options.dev.useHotClient
		? KoaWebpackDevelopPlugin
		: HotMiddlewareDevemopPlugin;
	const middleware = new MiddlewareClass(webpackConfig);
	return middleware.initilize().then(() => middleware);
};
