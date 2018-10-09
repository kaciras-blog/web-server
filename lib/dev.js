const config = require("../config");
const { createBundleRenderer } = require("vue-server-renderer");
const clientConfig = require(config.dev.clientConfig);
const hotMiddleware = require("webpack-hot-middleware");
const webpack = require("webpack");

let template;
let clientManifest;
let serverBundle;
let render;

const clientCompiler = webpack(clientConfig);
const devMiddleware = require("webpack-dev-middleware")(clientCompiler);
clientConfig.entry.app = ["webpack-hot-middleware/client", clientConfig.entry.app];
clientConfig.output.filename = "[name].js";
clientConfig.plugins.push(
	new webpack.HotModuleReplacementPlugin(),
	new webpack.NoEmitOnErrorsPlugin()
);

clientCompiler.plugin("done", stats => {
	stats = stats.toJson();
	stats.errors.forEach(err => console.error(err));
	stats.warnings.forEach(err => console.warn(err));
	if (stats.errors.length) return;

	clientManifest = JSON.parse(readFile(devMiddleware.fileSystem, "vue-ssr-client-manifest.json"));
	update();
});

module.exports.createRenderFunction = function () {
	if (!render) {
		render = createBundleRenderer(serverBundle, { template, clientManifest, runInNewContext: false });
	}
	return render;
};

module.exports.middlewares = [devMiddleware, hotMiddleware];
