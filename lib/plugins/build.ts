import path from "path";
import { promisify } from "util";
import fs from "fs-extra";
import webpack, { Configuration, Stats } from "webpack";
import chalk from "chalk";
import ClientConfiguration from "../template/client.config";
import ServerConfiguration from "../template/server.config";


const compile: (arg1: Configuration) => Promise<Stats> = promisify<Configuration, Stats>(webpack);

/**
 * 调用webpack，并输出更友好的信息。
 *
 * @param config 配置
 * @return {Promise<void>} 指示构建状态
 */
async function invokeWebpack(config: Configuration) {
	const stats = await compile(config);

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
export default async function build(options: any) {
	await fs.remove(path.join(options.outputPath, "static"));
	await invokeWebpack(ClientConfiguration(options));
	await invokeWebpack(ServerConfiguration(options));
}
