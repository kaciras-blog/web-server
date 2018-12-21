import path from "path";
import fs from "fs-extra";
import koaWebpack from "koa-webpack";
import webpack, { Compiler, Configuration, MultiCompiler, Plugin } from "webpack";
import { promisify } from "util";
import { createBundleRenderer } from "vue-server-renderer";
import MFS from "memory-fs";
import { Context, Middleware } from "koa";
import { WebpackDevMiddleware } from "webpack-dev-middleware";
import WebpackHotMiddlewareType from "webpack-hot-middleware";
import { NextHandleFunction } from "connect";
import { ServerResponse } from "http";
import ClientConfiguration from "../template/client.config";
import ServerConfiguration from "../template/server.config";
import { EventEmitter } from "events";


interface ClientManifestUpdatePlugin {
	on(event: "update", listener: (manifest: any) => void): this
}

/**
 * 读取并保存 VueSSRClientPlugin 输出的清单文件的 Webpack 插件
 */
class ClientManifestUpdatePlugin extends EventEmitter implements Plugin {

	readonly id = "ClientManifestUpdatePlugin";

	clientManifest: any;

	private readonly filename: string;

	constructor(filename: string = "vue-ssr-client-manifest.json") {
		super();
		this.filename = filename;
	}

	apply(compiler: Compiler): void {
		compiler.hooks.afterEmit.tap(this.id, compilation => {
			if (compilation.getStats().hasErrors()) return;
			this.clientManifest = JSON.parse(compilation.assets[this.filename].source());
			this.emit("update", this.clientManifest);
		});
	}
}

abstract class AbstractDevelopPlugin {

	protected readonly options: any;

	middleware!: Middleware;

	protected serverBundle: any;
	protected template: any;
	protected clientManifest: any;

	private renderFunction!: Function;

	constructor(options: any) {
		this.options = options;
	}

	/**
	 * 读取特定的文件系统（比如webpack的内存文件系统memory-fs）中的文件。
	 *
	 * @param fs 文件系统
	 * @param file 文件路径
	 */
	readFile(fs: MFS, file: string) {
		try {
			const path0 = path.join(this.options.webpack.outputPath, file);
			return fs.readFileSync(path0, "utf-8");
		} catch (ignore) {
			// return undefined
		}
	};

	async initilize() {
		const { webpack } = this.options;

		const clientConfig = ClientConfiguration(webpack);

		const cu = new ClientManifestUpdatePlugin();
		cu.on("update", manifest => {
			this.clientManifest = manifest;
			this.updateVueSSR();
		});
		if (!clientConfig.plugins) {
			clientConfig.plugins = []; // 我觉得不太可能一个插件都没有
		}
		clientConfig.plugins.push(cu);

		const serverConfig = ServerConfiguration(webpack);
		return Promise.all([this.initClientCompiler(clientConfig), this.initServerCompiler(serverConfig)]);
	}

	abstract async initClientCompiler(config: Configuration): Promise<void>;

	async initServerCompiler(config: Configuration) {
		// watch template changes ?
		this.template = await fs.promises.readFile(this.options.webpack.server.template, "utf-8");

		const serverCompiler = webpack(config);
		const mfs = new MFS();
		serverCompiler.outputFileSystem = mfs;
		serverCompiler.watch({}, (err, stats) => {
			if (err) throw err;
			if (stats.toJson().errors.length) return;

			this.serverBundle = JSON.parse(this.readFile(mfs, "vue-ssr-server-bundle.json"));
			this.updateVueSSR();
		});
	}

	/**
	 * 更新Vue的服务端渲染器，在客户端或服务端构建完成后调用。
	 */
	updateVueSSR() {
		const { serverBundle, template, clientManifest } = this;
		const render = createBundleRenderer(serverBundle, { template, clientManifest, runInNewContext: false });
		this.renderFunction = promisify(render.renderToString);
	}

	get renderFunctionFactory() {
		return () => this.renderFunction;
	}
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

export default function (options: any) {
	// 添加当前工作目录到模块路径中，在使用 npm link 本地安装时需要。
	process.env.NODE_PATH = path.resolve("node_modules");
	require("module").Module._initPaths();

	const MiddlewareClass = options.dev.useHotClient
		? KoaWebpackDevelopPlugin
		: HotMiddlewareDevemopPlugin;
	const middleware = new MiddlewareClass(options);
	return middleware.initilize().then(() => middleware);
};
