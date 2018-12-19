jest.mock("fs"); // Jest对Node的核心库必需显示调用Mock

const image = require("../lib/image");
const fs = require("fs-extra");
const sha3 = require("js-sha3").sha3_256;


const middleware = image({
	imageRoot: "",
	cacheMaxAge: 0,
});

it("POST for save new file", async () => {
	const content = "TEST CONTENT";

	const ctx = {
		method: "POST",
		path: "/image",
		req: {
			file: {
				originalname: "test.png",
				buffer: content,
			},
		},
		set: jest.fn(),
	};
	const next = jest.fn();
	await middleware(ctx, next);

	expect(ctx.status).toBe(201);
	expect(next.mock.calls.length).toBe(0);
	fs.accessSync(sha3(content) + ".png");
});

it("POST for return exists file", async () => {
	const content = "TEST CONTENT EXISTS";
	fs.writeFileSync(sha3(content) + ".png", content);

	const ctx = {
		method: "POST",
		path: "/image",
		req: {
			file: {
				originalname: "test.png",
				buffer: content,
			},
		},
		set: jest.fn(),
	};
	const next = jest.fn();
	await middleware(ctx, next);

	expect(ctx.status).toBe(200);
	expect(next.mock.calls.length).toBe(0);
});