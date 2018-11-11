const path = require("path");
const { promisify } = require("util");
const config = require("../config");
const { createBundleRenderer } = require("vue-server-renderer");
const hotMiddleware = require("webpack-hot-middleware");
const webpack = require("webpack");
const MFS = require("memory-fs");
const clientConfig = require(config.dev.client);
const serverConfig = require(config.dev.server);

const readFile = (fs, file) => {
	try {
		return fs.readFileSync(path.join(clientConfig.output.path, file), "utf-8");
	} catch (ignore) {
	}
};


let template;
let clientManifest;
let serverBundle;
let renderFunction;

function update () {
	const render = createBundleRenderer(serverBundle, { template, clientManifest, runInNewContext: false });
	renderFunction = promisify(render.renderToString);
}

const clientCompiler = webpack(clientConfig);
const devMiddleware = require("webpack-dev-middleware")(clientCompiler);
clientConfig.entry.app = ["webpack-hot-middleware/client", clientConfig.entry.app];
clientConfig.output.filename = "[name].js";
clientConfig.plugins.push(
	new webpack.HotModuleReplacementPlugin(),
	new webpack.NoEmitOnErrorsPlugin(),
);

clientCompiler.plugin("done", stats => {
	stats = stats.toJson();
	stats.errors.forEach(err => console.error(err));
	stats.warnings.forEach(err => console.warn(err));
	if (stats.errors.length) return;

	clientManifest = JSON.parse(readFile(devMiddleware.fileSystem, "vue-ssr-client-manifest.json"));
	update();
});

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

module.exports.createRenderFunction = function () {
	return renderFunction;
};

module.exports.setupDevServer = function (app) {
	app.use(devMiddleware);
	app.use(hotMiddleware(clientCompiler, { heartbeat: 5000 }));
};
