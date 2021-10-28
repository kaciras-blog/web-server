import { promisify } from "util";
import process from "process";
import { cyan, red } from "colorette";
import webpack, { Configuration, Stats } from "webpack";
import fs from "fs-extra";
import { DevelopmentOptions } from "../options";
import ClientConfiguration from "../config/client";
import ServerConfiguration from "../config/server";

// 没有类型定义
const SpeedMeasurePlugin = require("speed-measure-webpack-plugin");

/**
 * 调用 webpack，并输出更友好的信息。
 *
 * @param config webpack的配置
 */
async function invokeWebpack(config: Configuration) {
	const stats = await promisify<Configuration, Stats>(webpack)(config);

	if (stats.hasErrors()) {
		console.log(stats.toString({
			colors: true,
			modules: false,
			children: true,
			chunks: false,
			chunkModules: false,
		}));
		console.log(red("Build failed with errors.\n"));
		process.exit(1);
	}
}

export default async function (options: DevelopmentOptions) {
	await fs.remove(options.outputDir);

	let clientConfig = ClientConfiguration(options);

	if (options.webpack.speedMeasure) {
		const smp = new SpeedMeasurePlugin();
		clientConfig = smp.wrap(clientConfig);
	}

	await invokeWebpack(clientConfig);
	console.log(cyan("Client Build complete."));

	await invokeWebpack(ServerConfiguration(options));
	console.log(cyan("Server build complete."));
}
