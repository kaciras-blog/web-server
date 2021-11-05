import { getModuleSource, resolveFixture, runWebpack } from "./test-utils";

it("should change attributes", async () => {
	const stats = await runWebpack({
		entry: resolveFixture("visible-off.svg"),
		module: {
			rules: [{
				test: /\.(svg)(\?.*)?$/,
				use: require.resolve("../lib/webpack/reactive-svg-loader"),
				type: "asset/resource",
			}],
		},
	});
	expect(getModuleSource(stats, "visible-off.svg").toString()).toMatchSnapshot();
});
