import { basename, resolve } from "path";
import { expect, it } from "vitest";
import { Plugin } from "vite";
import vue from "@vitejs/plugin-vue";
import { resolveFixture, runVite, testEntry } from "./test-utils";
import vueSvgComponent from "../lib/plugin/vue-svg-component";
import vm from "vm";
import { createApp } from "vue";
import { renderToString } from "@vue/server-renderer";
import { createRequire } from "module";


const testT: Plugin = {
	name: "test:output-transform",

	transform(code: string, id: string) {
		if (!id.endsWith(".svg.vue")) {
			return;
		}
		this.emitFile({
			type: "asset",
			name: id,
			fileName: basename(id),
			source: code,
		});
		return "export default '_EXTRACTED_'";
	},
};

function loadBundle<T = any>(code: string) {
	const modulesPath = resolve(__dirname, "../node_modules");
	const require = createRequire(modulesPath);

	const context = { exports: {}, require };
	vm.runInNewContext(code, context, { filename: "test.cjs" });
	return context.exports as T;
}

it("should change attributes", () => {

});

it("should extract styles", async () => {
	const bundle = await runVite(
		{
			assetsInclude: /\.svg\.vue$/,
			plugins: [
				vueSvgComponent(),
				testT,
				testEntry("import svg from './inline-styles.svg?sfc'"),
			],
		},
	);

	const s = bundle.output.find(v => v.fileName === "inline-styles.svg.vue");
	expect(s.source.toString()).toMatchSnapshot();
});

it("should work with @vitejs/plugin-vue", async () => {
	const bundle = await runVite(
		{
			build: {
				ssr: resolveFixture("inline-styles.svg?sfc"),
				write: false,
			},
			plugins: [
				vueSvgComponent(),
				vue(),
			],
		},
	);
	console.log(bundle);
	const component = loadBundle(bundle.output[0].code).default;

	const app = createApp(component, { width: 4396 });
	expect(await renderToString(app)).toMatchSnapshot();
});
