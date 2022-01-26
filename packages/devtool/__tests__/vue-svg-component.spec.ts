import { basename } from "path";
import { expect, it } from "vitest";
import { Plugin } from "vite";
import vue from "@vitejs/plugin-vue";
import { getAsset, runVite } from "./test-utils";
import vueSvgComponent from "../lib/plugin/vue-svg-component";
import vm from "vm";
import { createApp } from "vue";
import { renderToString } from "@vue/server-renderer";
import { createRequire } from "module";

/**
 * 把转成 SFC 的 SVG 提取出来作为一个 Asset。
 */
const extractCodePlugin: Plugin = {
	name: "test:extract-code",
	transform(code: string, id: string) {
		if (!id.endsWith(".svg.vue")) {
			return;
		}
		this.emitFile({
			type: "asset",
			name: id,
			fileName: basename(id, ".vue"),
			source: code,
		});
		return "window.avoidWarn = 1";
	},
};

async function convert(input: string, mode?: string) {
	const bundle = await runVite({
		mode,
		build: {
			rollupOptions: { input },
		},
		plugins: [
			vueSvgComponent(),
			extractCodePlugin,
		],
	});
	return getAsset(bundle, input);
}

function loadBundle<T = any>(code: string) {
	const require = createRequire(import.meta.url);
	const context = { exports: {}, require };
	vm.runInNewContext(code, context, { filename: "test.cjs" });
	return context.exports as T;
}

it("should throw on non-SVG data", async () => {
	const build = convert("png-data.svg?sfc");
	await expect(build).rejects.toThrow();
});

it("should change attributes in %s", async () => {
	expect(await convert("visible-off.svg?sfc")).toMatchSnapshot();
});

it("should remove processing instruction in %s", async () => {
	expect(await convert("instruction.svg?sfc")).toMatchSnapshot();
});

it("should extract styles", async () => {
	const source = await convert("inline-styles.svg?sfc");
	expect(source.toString()).toMatchSnapshot();
});

// 这个测试生成的 scopeId 可能会变化，注意重新生成快照。
it("should work with @vitejs/plugin-vue", async () => {
	const bundle = await runVite(
		{
			build: {
				ssr: "inline-styles.svg?sfc",
			},
			plugins: [
				vue(),
				vueSvgComponent(),
			],
		},
	);
	const component = loadBundle(bundle.output[0].code).default;
	const app = createApp(component, { width: 4396 });
	expect(await renderToString(app)).toMatchSnapshot();
});
