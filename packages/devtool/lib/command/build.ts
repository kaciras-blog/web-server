import { DevelopmentOptions } from "../options";
import fs from "fs-extra";
import ClientConfiguration from "../config/client";
import ServerConfiguration from "../config/server";
import chalk from "chalk";
import webpack, { Configuration, Stats } from "webpack";
import { promisify } from "util";

// 没有类型定义
const SpeedMeasurePlugin = require("speed-measure-webpack-plugin");

/**
 * 调用 webpack，并输出更友好的信息。
 *
 * @param config webpack的配置
 */
async function invokeWebpack(config: Configuration) {
	const stats = await promisify<Configuration, Stats>(webpack)(config);

	console.log(stats.toString("errors-warnings"));

	if (stats.hasErrors()) {
		console.log(chalk.red("Build failed with errors.\n"));
		process.exit(1);
	}
}

export default async function (options: DevelopmentOptions)  {
	await fs.remove(options.outputDir);

	let clientConfig = ClientConfiguration(options)

	if (options.webpack.speedMeasure) {
		const smp = new SpeedMeasurePlugin();
		clientConfig = smp.wrap(clientConfig);
	}

	await invokeWebpack(clientConfig);
	console.log(chalk.cyan("Client Build complete."));

	await invokeWebpack(ServerConfiguration(options));
	console.log(chalk.cyan("Server build complete."));
}