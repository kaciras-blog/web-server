import { getModuleSource, resolveFixture, runWebpack } from "./test-utils";

async function compile(file: string, mode: any) {
	const stats = await runWebpack({
		mode,
		entry: resolveFixture(file),
		module: {
			rules: [{
				test: /\.(svg|png)(\?.*)?$/,
				use: require.resolve("../lib/webpack/reactive-svg-loader"),
				type: "asset/resource",
			}],
		},
	});
	return getModuleSource(stats, file).toString();
}

const modes = ["development", "production"];

test.each(modes)("should change attributes in %s", async (mode) => {
	expect(await compile("visible-off.svg", mode)).toMatchSnapshot();
});

test.each(modes)("should remove processing instruction in %s", async (mode) => {
	expect(await compile("instruction.svg", mode)).not.toMatch(/^<\?xml /);
});

it("should throw on non-SVG data", () => {
	return expect(compile("test.png", "development")).rejects.toThrow();
});
