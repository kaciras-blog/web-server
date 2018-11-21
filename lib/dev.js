const path = require("path");
const { promisify } = require("util");
const { createBundleRenderer } = require("vue-server-renderer");
const koaWebpack = require("koa-webpack");
const webpack = require("webpack");
const MFS = require("memory-fs");


module.exports = async function (clientConfig, serverConfig) {
	let template;
	let clientManifest;
	let serverBundle;
	let renderFunction;

	/**
	 * 读取特定的文件系统（比如webpack的内存文件系统memory-fs）中的文件。
	 * @param fs 文件系统
	 * @param file 文件路径
	 * @return {*} 文件内容
	 */
	const readFile = (fs, file) => {
		try {
			return fs.readFileSync(path.join(clientConfig.output.path, file), "utf-8");
		} catch (ignore) {
		}
	};

	/**
	 * 更新Vue的服务端渲染器，在客户端或服务端构建完成后调用。
	 */
	function update () {
		const render = createBundleRenderer(serverBundle, { template, clientManifest, runInNewContext: false });
		renderFunction = promisify(render.renderToString);
	}

	// 对客户端构建的监听
	const clientCompiler = webpack(clientConfig);
	clientConfig.output.filename = "[name].js";
	const middleware = await koaWebpack({ compiler: clientCompiler });

	clientCompiler.plugin("done", stats => {
		stats = stats.toJson();
		stats.errors.forEach(err => console.error(err));
		stats.warnings.forEach(err => console.warn(err));
		if (stats.errors.length) return;

		clientManifest = JSON.parse(readFile(middleware.devMiddleware.fileSystem, "vue-ssr-client-manifest.json"));
		update();
	});

	// 服务端构建监听
	const serverCompiler = webpack(serverConfig);
	const mfs = new MFS();
	serverCompiler.outputFileSystem = mfs;
	serverCompiler.watch({}, (err, stats) => {
		if (err) throw err;
		stats = stats.toJson();
		if (stats.errors.length) return;

		serverBundle = JSON.parse(readFile(mfs, "vue-ssr-server-bundle.json"));
		update();
	});

	return {
		createRenderFunction: () => renderFunction,

		/**
		 * 配置Koa应用，增加热重载中间件。
		 *
		 * @param app Koa应用实例
		 */
		setUp: app => app.use(middleware),
	};
};
