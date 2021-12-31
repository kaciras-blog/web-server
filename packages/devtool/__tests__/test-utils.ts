import { join } from "path";
import webpack, { Configuration, StatsCompilation } from "webpack";
import MemoryFs from "memory-fs";
import { merge } from "webpack-merge";

/**
 * 运行 webpack，返回输出到内存中的结果。
 *
 * @param config webpack 的配置
 * @param fs 构建的文件将写入此处
 * @return 构建的结果信息。
 */
export function runWebpack(config: Configuration, fs = new MemoryFs()) {
	const baseConfig: Configuration = {
		mode: "development",
		devtool: false,
		output: {
			path: "/",
			hashFunction: "xxhash64",
		},
		// pnpm 把依赖放在每个包的目录下，在根目录运行测试时需要添加一下。
		resolveLoader: {
			modules: [
				"node_modules",
				join(__dirname, "../node_modules"),
			],
		},
	};
	config = merge(baseConfig, config);

	return new Promise<StatsCompilation>((resolve, reject) => {
		const compiler = webpack(config);
		compiler.outputFileSystem = fs;

		compiler.run((err, stats) => {
			if (err || !stats) {
				return reject(err);
			}
			if (stats.hasErrors()) {
				const msg = stats.toString({
					children: true,
				});
				return reject(new Error(msg));
			}
			return resolve(stats.toJson({ source: true }));
		});
	});
}

export function getModuleSource(stats: StatsCompilation, id: string) {
	const module = stats.modules!.find(m => m.name!.endsWith(id));
	if (module) {
		return module.source!;
	}
	throw new Error(`module ${id} not found in completion`);
}

/**
 * 返回fixtures目录下文件的完整路径。
 *
 * @param name 文件名
 * @return 完整路径
 */
export function resolveFixture(name: string) {
	return join(__dirname, "fixtures", name);
}
