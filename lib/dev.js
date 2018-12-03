const path = require("path");
const fs = require("fs");
const { promisify } = require("util");
const { createBundleRenderer } = require("vue-server-renderer");
const koaWebpack = require("koa-webpack");
const webpack = require("webpack");
const MFS = require("memory-fs");


class AbstractDevelopPlugin {

	constructor (options) {
		this.options = options;
	}

	/**
	 * 读取特定的文件系统（比如webpack的内存文件系统memory-fs）中的文件。
	 *
	 * @param fs 文件系统
	 * @param file 文件路径
	 * @return {*} 文件内容
	 */
	readFile (fs, file) {
		try {
			const path0 = path.join(this.options.webpack.outputPath, file);
			return fs.readFileSync(path0, "utf-8");
		} catch (ignore) {
			// return undefined
		}
	};

	async initilize () {
		// 添加当前工作目录到模块路径中，在使用 npm link 本地安装时需要。
		process.env.NODE_PATH = path.resolve("node_modules");
		require("module").Module._initPaths();

		const { webpack } = this.options;

		const clientConfig = require(webpack.client.file)(webpack);
		const serverConfig = require(webpack.server.file)(webpack);
		return Promise.all([this.initClientCompiler(clientConfig), this.initServerCompiler(serverConfig)]);
	}

	async initClientCompiler (config) {
		throw Error();
	}

	async initServerCompiler (config) {
		// watch template changes ?
		this.template = await fs.promises.readFile("D:\\Project\\Blog\\WebContent\\public\\index.template.html", "utf-8");

		const serverCompiler = webpack(config);
		const mfs = new MFS();
		serverCompiler.outputFileSystem = mfs;
		serverCompiler.watch({}, (err, stats) => {
			if (err) throw err;
			stats = stats.toJson();
			if (stats.errors.length) return;

			this.serverBundle = JSON.parse(this.readFile(mfs, "vue-ssr-server-bundle.json"));
			this.updateVueSSR();
		});
	}

	/**
	 * 更新Vue的服务端渲染器，在客户端或服务端构建完成后调用。
	 */
	updateVueSSR () {
		const { serverBundle, template, clientManifest } = this;
		const render = createBundleRenderer(serverBundle, { template, clientManifest, runInNewContext: false });
		this.renderFunction = promisify(render.renderToString);
	}

	get renderFunctionFactory () {
		return () => this.renderFunction;
	}
}


class KoaWebpackDevelopPlugin extends AbstractDevelopPlugin {

	async initClientCompiler (config) {
		const clientCompiler = webpack(config);
		config.output.filename = "[name].js";

		/*
		 * 此处有一坑，Firefox默认禁止从HTTPS页面访问WS连接，又有Http2模块不存在upgrade事件导致
		 * webpack-hot-client 无法创建 websocket。
		 * 当前做法是关闭Firefox的 network.websocket.allowInsecureFromHTTPS 设为true。
		 */
		// const webSocketServer = https.createServer({
		// 	key: fs.readFileSync(config.privatekey),
		// 	cert: fs.readFileSync(config.certificate),
		// }).listen(5678, "localhost");

		const middleware = await koaWebpack({ compiler: clientCompiler });

		clientCompiler.hooks.done.tap("update server manifest", stats => {
			stats = stats.toJson();
			stats.errors.forEach(err => console.error(err));
			stats.warnings.forEach(err => console.warn(err));
			if (stats.errors.length) return;

			this.clientManifest = JSON.parse(this.readFile(
				middleware.devMiddleware.fileSystem,
				"vue-ssr-client-manifest.json"));

			this.updateVueSSR();
			console.info("server is listening on: https://localhost");
		});

		this.middleware = middleware;
	}
}

class HotMiddlewareDevemopPlugin extends AbstractDevelopPlugin {

	constructor (options) {
		super(options);
		this.middleware = this.middleware.bind(this);
	}

	async initClientCompiler (config) {
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
		});
		clientCompiler.hooks.done.tap("update client manifest", stats => {
			stats = stats.toJson();
			stats.errors.forEach(err => console.error(err));
			stats.warnings.forEach(err => console.warn(err));
			if (stats.errors.length) return;

			this.clientManifest = JSON.parse(this.readFile(
				devMiddleware.fileSystem,
				"vue-ssr-client-manifest.json",
			));
			this.updateVueSSR();
		});

		this.clientCompiler = clientCompiler;
		this.devMiddleware = devMiddleware;
		this.hotMiddleware = require("webpack-hot-middleware")(clientCompiler, { heartbeat: 5000 });
	}

	middleware (ctx, next) {
		const innerNext = () => {
			return new Promise(resolve => this.hotMiddleware(ctx.req, ctx.res, () => resolve(next())));
		};

		// wait for webpack-dev-middleware to signal that the build is ready
		return Promise.all([
			new Promise((resolve, reject) => {
				for (const comp of [].concat(this.clientCompiler.compilers || this.clientCompiler)) {
					comp.hooks.failed.tap("KoaWebpack", reject);
				}
				this.devMiddleware.waitUntilValid(() => resolve(true));
			}),
			new Promise((resolve) => {
				const resAdapter = {
					end: (content) => {
						ctx.body = content;
						resolve();
					},
					setHeader: ctx.set.bind(ctx),
					locals: ctx.state,
				};
				this.devMiddleware(ctx.req, resAdapter, () => resolve(innerNext()));
			}),
		]);
	}
}

module.exports = function (options) {
	const MiddlewareClass = options.dev.useHotClient
		? KoaWebpackDevelopPlugin
		: HotMiddlewareDevemopPlugin;
	const middleware = new MiddlewareClass(options);
	return middleware.initilize().then(() => middleware);
};
