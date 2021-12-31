import vm from "vm";
import nodeExternals from "webpack-node-externals";
import MemoryFs from "memory-fs";
import { renderToString } from "@vue/server-renderer";
import { VueLoaderPlugin } from "vue-loader";
import { createApp } from "vue";
import { getModuleSource, resolveFixture, runWebpack } from "./test-utils";

function loadBundle<T = any>(code: string) {
	const context = { module: { exports: {} }, require };
	vm.runInNewContext(code, context);
	return context.module.exports as T;
}

const ssrConfig = {
	plugins: [
		new VueLoaderPlugin(),
	],
	target: "node",
	output: {
		library: {
			type: "commonjs2",
		},
	},
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

it("should extract styles", async () => {
	const config = {
		entry: resolveFixture("inline-styles.svg"),
		module: {
			rules: [{
				test: /\.(svg|vue)(\?.*)?$/,
				use: require.resolve("../lib/webpack/vue-template-loader"),
				type: "asset/source",
			}],
		},
	};
	const stats = await runWebpack(config);
	expect(getModuleSource(stats, "inline-styles.svg").toString()).toMatchSnapshot();
});

it("should failed if have script element", () => {
	const config = {
		target: "web",
		entry: resolveFixture("inline-styles.svg"),
	};
	const compilation = runWebpack({ ...ssrConfig, ...config });
	return expect(compilation).rejects.toThrow();
});

/**
 * 因为 vue-template-loader 要搭配 vue-loader 所以一起测一下。
 * 又因为编译的结果很难去断言，所以又 SSR 了一下，顺便测个 props。
 */
it("should convert file to component", async () => {
	const fs = new MemoryFs();

	const config = {
		entry: resolveFixture("visible-off.svg"),
	};

	await runWebpack({ ...ssrConfig, ...config }, fs);
	const exports = loadBundle(fs.readFileSync("/main.js", "utf8"));

	const app = createApp(exports.default, { width: 4396 });
	expect(await renderToString(app)).toMatchSnapshot();
});
