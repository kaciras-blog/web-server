import { describe, it, vi } from "vitest";
import Koa from "koa";
import supertest from "supertest";
import { adminOnlyFilter } from "../lib/blog.js";

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("adminOnlyFilter", () => {
	const app = new Koa();
	app.use(adminOnlyFilter("/test/user"));
	app.use(ctx => ctx.body = "hello world");

	it("should 403 for guests", async () => {
		mockFetch.mockResolvedValue({ status: 200, json: () => ({ id: 0 }) });
		await supertest(app.callback()).get("/").expect(403);
	});

	it("should continue for admin", async () => {
		mockFetch.mockResolvedValue({ status: 200, json: () => ({ id: 2 }) });
		await supertest(app.callback()).get("/").expect(200, "hello world");
	});
});
