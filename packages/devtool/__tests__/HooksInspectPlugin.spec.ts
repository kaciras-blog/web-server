import { resolveFixture, runWebpack } from "./test-utils";
import HooksInspectPlugin from "../lib/webpack/HooksInspectPlugin";

it("should effect", async () => {
	const hits = [];
	const spy = jest.spyOn(console, "log")
		.mockImplementation(msg => hits.push(msg));

	await runWebpack({
		entry: resolveFixture("entry-empty.js"),
		output: {
			path: "/",
		},
		plugins: [new HooksInspectPlugin()],
	});

	spy.mockRestore();
	expect(hits.length).toBeGreaterThan(0);
});
