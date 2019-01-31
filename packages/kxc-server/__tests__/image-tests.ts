import { createImageMiddleware } from "../middlewares";
import fs from "fs-extra";
import { sha3_256 } from "js-sha3";


jest.mock("fs"); // Jest对Node的核心库的Mock必须显示调用

const middleware = createImageMiddleware({
	imageRoot: "",
	cacheMaxAge: 0,
});

it("POST for save new file", async () => {
	const content = "TEST CONTENT";

	const ctx: any = {
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
	fs.accessSync(sha3_256(content) + ".png");
});

it("POST for return exists file", async () => {
	const content = "TEST CONTENT EXISTS";
	fs.writeFileSync(sha3_256(content) + ".png", content);

	const ctx: any = {
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

it("Invaild method", async () => {
	const content = "TEST CONTENT EXISTS";

	const ctx: any = {
		method: "PUT",
		path: "/image/" + sha3_256(content) + ".png",
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

	expect(ctx.status).toBe(405);
	expect(next.mock.calls.length).toBe(0);
});
