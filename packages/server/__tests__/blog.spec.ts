import axios from "axios";
import Koa from "koa";
import supertest from "supertest";
import { adminOnlyFilter, intercept } from "../lib/blog";
import Mock = jest.Mock;

jest.mock("axios");

describe("intercept middleware", () => {
	const app = new Koa();
	app.use(intercept(/(\.(?:js|css)\.map$)|(^\/index\.template|vue-ssr)/));
	app.use((ctx) => ctx.status = 200);
	const callback = app.callback();

	it("should accept", async () => {
		await supertest(callback).get("/vendors.js").expect(200);
		await supertest(callback).get("/index.html").expect(200);
	});

	it("should reject file", async () => {
		await supertest(callback)
			.get("/index.template.html")
			.expect(404);
		await supertest(callback)
			.get("/vue-ssr-client-manifest.json")
			.expect(404);
	});

	it("should check only path", () => {
		return supertest(callback)
			.get("/foo.js.map?query=0#hash")
			.expect(404);
	});
});

describe("adminOnlyFilter", () => {
	const app = new Koa();
	app.use(adminOnlyFilter("/test/user"));
	app.use(ctx => ctx.body = "hello world");

	it("should 403 for guests", () => {
		(axios.get as Mock).mockResolvedValue({ status: 200, data: { id: 0 } });
		return supertest(app.callback()).get("/").expect(403);
	});

	it("should continue for admin", () => {
		(axios.get as Mock).mockResolvedValue({ status: 200, data: { id: 2 } });
		return supertest(app.callback()).get("/").expect(200, "hello world");
	});
});
