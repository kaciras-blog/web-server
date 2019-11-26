import path from "path";
import webpack, { Configuration } from "webpack";
import MemoryFs from "memory-fs";

export function runWebpack(config: Configuration) {
	return new Promise<MemoryFs>((resolve, reject) => {
		const outputFs = new MemoryFs();
		const compiler = webpack(config);
		compiler.outputFileSystem = outputFs;

		compiler.run((err, stats) => {
			if (err) {
				return reject(err);
			}
			if (stats.hasErrors()) {
				const msg = stats.toString({
					children: true,
				});
				return reject(new Error(msg));
			}
			return resolve(outputFs);
		});
	});
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
