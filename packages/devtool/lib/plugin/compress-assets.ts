import { writeFileSync } from "fs";
import { join } from "path";
import { promisify } from "util";
import { brotliCompress, gzip, InputType } from "zlib";
import { Plugin } from "vite";

// 经测试，最大压缩率参数（如 BROTLI_MAX_QUALITY）用不用大小都一样。

const zlibMap = {
	gz: promisify<InputType, Buffer>(gzip),
	br: promisify(brotliCompress),
};

export interface CompressOptions {

	/**
	 * 压缩算法，gz 或 br。若要同时使用请多次添加该插件。
	 */
	algorithm: keyof typeof zlibMap;

	/**
	 * 那些文件需要压缩？默认 /\.(m?js|json|svg|css|html)$/
	 */
	includes?: RegExp;

	/**
	 * 文件小于该字节数时不压缩，默认 2048。
	 */
	minSize?: number;

	/**
	 * 丢弃压缩比（压缩后 / 原大小）大于该值的结果，默认 1.0。
	 * 这个选项用于防止生成压缩效果太差的文件。
	 */
	maxRatio?: number;

	/**
	 * 默认仅作用于在客户端构建，该参数为 true 则任何情况都启用。
	 */
	force?: boolean;
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
		minSize = 2048,
		maxRatio = 1.0,
		force = false,
		includes = /\.(m?js|json|svg|css|html)$/,
	} = options;

	const compress = zlibMap[algorithm];

	return {
		name: "kaciras:compress-assets",

		// 因为 OutputGenerate 钩子仅在构建时调用，所以省了 command 判断。
		apply(config, env) {
			return force || !config.build?.ssr && env.mode === "production";
		},

		/**
		 * vite:build-import-analysis 用了 generateBundle 钩子处理代码，
		 * 而且它还在 enforce: "post" 之后，导致本插件只能使用更后面的钩子。
		 *
		 * 因为在 writeBundle 里没法 emitFile，所以只能写文件了。
		 *
		 * <h2>代码重复？</h2>
		 * 这里的逻辑跟 media 模块里压 SVG 的相同，但代码很少也必要复用。
		 */
		async writeBundle(options, bundle) {
			const dir = options.dir!;

			for (const [k, v] of Object.entries(bundle)) {
				if (!includes.test(k)) {
					continue;
				}
				const raw = v.type === "chunk" ? v.code : v.source;

				if (raw.length < minSize) {
					continue;
				}
				const output = await compress(raw);

				if (output.length / raw.length > maxRatio) {
					continue;
				}
				const fileName = `${v.fileName}.${algorithm}`;
				writeFileSync(join(dir, fileName), output);
			}
		},
	};
}
