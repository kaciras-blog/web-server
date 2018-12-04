const image = require("../lib/image");


const middleware = image({
	imageRoot: "temp",
	cacheMaxAge: 0,
});

it("s", async () => {
	const ctx = {
		method: "POST",
		path: "/image",
		req: {
			file: {
				originalname: "test.png",
				buffer: "",
			},
		},
		set: jest.fn(),
	};
	const next = jest.fn();
	await middleware(ctx, next);

	expect(next.mock.calls.length).toBe(0);
	// expect(ctx.set.mock.calls[0][0]).toBe(0);
});
