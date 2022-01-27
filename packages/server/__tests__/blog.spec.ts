import { describe, it, SpyInstanceFn, vi } from "vitest";
import axios from "axios";
import Koa from "koa";
import supertest from "supertest";
import { adminOnlyFilter } from "../lib/blog";

vi.mock("axios");

describe("adminOnlyFilter", () => {
	const app = new Koa();
	app.use(adminOnlyFilter("/test/user"));
	app.use(ctx => ctx.body = "hello world");

	it("should 403 for guests", async () => {
		(axios.get as JestMockCompatFn).mockResolvedValue({ status: 200, data: { id: 0 } });
		await supertest(app.callback()).get("/").expect(403);
	});

	it("should continue for admin", async () => {
		(axios.get as JestMockCompatFn).mockResolvedValue({ status: 200, data: { id: 2 } });
		await supertest(app.callback()).get("/").expect(200, "hello world");
	});
});
