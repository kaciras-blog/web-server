import path from "path";
import webpack, { Configuration, StatsCompilation } from "webpack";
import MemoryFs from "memory-fs";
import { merge } from "webpack-merge";

/**
 * 运行webpack，返回输出到内存中的结果。
 *
 * @param config webpack的配置
 * @param fs 构建的文件将写入此处
 * @return 构建的结果信息。
 */
export function runWebpack(config: Configuration, fs = new MemoryFs()) {
	const baseConfig: Configuration = {
		mode: "development",
		devtool: false,
		output: { path: "/" },
	};
	config = merge(baseConfig, config);

	return new Promise<StatsCompilation>((resolve, reject) => {
		const compiler = webpack(config);
		compiler.outputFileSystem =fs;

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
	throw new Error(`module ${id} not found in complition`);
}

/**
 * 返回fixtures目录下文件的完整路径。
 *
 * @param name 文件名
 * @return 完整路径
 */
export function resolveFixture(name: string) {
	return path.join(__dirname, "fixtures", name);
}
