import { getModuleSource, resolveFixture, runWebpack } from "./test-utils";

it("should change attributes", async () => {
	const stats = await runWebpack({
		entry: resolveFixture("entry-svg.js"),
		module: {
			rules: [{
				test: /\.(svg)(\?.*)?$/,
				loader: require.resolve("../lib/webpack/reactive-svg-loader"),
				type: "asset/resource",
			}],
		},
	});
	expect(getModuleSource(stats, "visible-off.svg").toString()).toMatchSnapshot();
});
