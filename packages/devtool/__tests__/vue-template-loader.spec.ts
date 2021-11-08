import vm from "vm";
import nodeExternals from "webpack-node-externals";
import MemoryFs from "memory-fs";
import { renderToString } from "@vue/server-renderer";
import { VueLoaderPlugin } from "vue-loader";
import { createApp } from "vue";
import { resolveFixture, runWebpack } from "./test-utils";

function loadBundle<T = any>(code: string) {
	const context = { module: { exports: {} }, require };
	vm.runInNewContext(code, context);
	return context.module.exports as T;
}

/**
 * 因为 vue-template-loader 要搭配 vue-loader 所以一起测，而不是直接测它的输出。
 * 又因为编译的结果很难去断言，所以又用 SSR 渲染了一下，断言渲染的结果。
 */
it("should convert file to component", async () => {
	const fs = new MemoryFs();

	const config = {
		entry: resolveFixture("entry-svg.js"),
		target: "node",
		output: {
			libraryTarget: "commonjs2",
		},
		plugins: [
			new VueLoaderPlugin(),
		],
		externals: nodeExternals(),
		module: {
			rules: [{
				test: /\.(svg|vue)(\?.*)?$/,
				use: [
					"vue-loader",
					require.resolve("../lib/webpack/vue-template-loader"),
				],
			}],
		},
	};

	await runWebpack(config, fs);
	const exports = loadBundle(fs.readFileSync("/main.js", "utf8"));

	const app = createApp(exports.default, { width: 4396 });
	expect(await renderToString(app)).toMatchSnapshot();
});
