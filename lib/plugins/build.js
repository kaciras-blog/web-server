const path = require("path");
const chalk = require("chalk");
const { promisify } = require("util");
const fs = require("fs-extra");
const webpack = promisify(require("webpack"));


/**
 * 调用webpack，并输出更友好的信息。
 *
 * @param config 配置
 * @return {Promise<void>} 指示构建状态
 */
async function invokeWebpack (config) {
	const stats = await webpack(config);

	process.stdout.write(stats.toString({
		colors: true,
		modules: false,
		children: true, // Setting this to true will make TypeScript errors show up during build.
		chunks: false,
		chunkModules: false,
	}) + "\n\n");

	if (stats.hasErrors()) {
		console.log(chalk.red("Build failed with errors.\n"));
		process.exit(1);
	}
	console.log(chalk.cyan("Build complete.\n"));
}

/**
 * 因为要构建客户端和预渲染两种环境下的输出，所以写了这个文件来统一构建。
 *
 * @param options Webpack选项
 * @return {Promise<void>} 指示构建状态
 */
module.exports = async function build (options) {
	await fs.remove(path.join(options.outputPath, "static"));
	await invokeWebpack(require("../template/client.config")(options));
	await invokeWebpack(require("../template/server.config")(options));
};
