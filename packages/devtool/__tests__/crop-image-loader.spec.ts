import { resolveFixture, runWebpack } from "./test-utils";

// TODO

it("should", async () => {
	const stats = await runWebpack({
		entry: resolveFixture("entry-empty.js"),
		module: {
			rules: [{
				test: /\.(png|jpg|gif|webp)$/,
				type: "asset/resource",
				generator: {
					filename: "[name][ext]",
				},
				loader: require.resolve("../lib/webpack/crop-image-loader"),
			}],
		},
	});

	// const output = stats.toJson({ source: true }).modules[0].source;
	// expect(output).toBe('export default "Hey Alice!\\n"');
});
