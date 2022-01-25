import { promisify } from "util";
import { brotliCompress, gzip } from "zlib";
import { OutputBundle } from "rollup";
import { Plugin } from "vite";

const zlibMap = {
	gz: promisify(gzip),
	br: promisify(brotliCompress),
};

export interface CompressOptions {
	includes?: RegExp;
	minSize?: number;
	algorithm: keyof typeof zlibMap;
}

/**
 * 压缩静态资源的插件，在打包的最后为输出的文件生成压缩的版本。
 *
 * <h2>为什么造轮子</h2>
 * vite-plugin-compression 导出有问题，一个月没修。
 * rollup-plugin-gzip API 反人类，压缩算法竟然要传函数……
 *
 * 而且这功能相当简单，代码不超过 100 行的，还是自己随手写一个吧。
 * 另外本插件使用 emitFile() 而不是直接写文件，扩展性更好。
 *
 * @param options 压缩选项
 */
export default function compressAssets(options: CompressOptions): Plugin {
	const {
		algorithm,
		minSize = 1024,
		includes = /\.(m?js|json|svg|css|html)$/,
	} = options;

	const compress = zlibMap[algorithm];

	return {
		name: "kaciras:compress-assets",
		enforce: "post",

		apply(config, env) {
			return !config.build?.ssr && env.command === "build";
		},

		async generateBundle(_: unknown, bundle: OutputBundle) {
			for (const [k, v] of Object.entries(bundle)) {
				if (!includes.test(k)) {
					continue;
				}
				let source = v.type === "chunk" ? v.code : v.source;

				if (source.length < minSize) {
					continue;
				}
				const fileName = `${v.fileName}.${algorithm}`;
				source = await compress(source);
				this.emitFile({ type: "asset", source, fileName });
			}
		},
	};
}
