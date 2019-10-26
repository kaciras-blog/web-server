import Koa from "koa";
import { intercept } from "../lib/blog-plugin";
import supertest from "supertest";


describe("intercept middleware", () => {
	const app = new Koa();
	app.use(intercept([
		/\.(?:js|css)\.map$/,
		new RegExp("^/index\\.template|vue-ssr"),
	]));
	app.use((ctx) => ctx.status = 200);
	const server = app.callback();

	it("should accept", async () => {
		await supertest(server).get("/vendors.js").expect(200);
		await supertest(server).get("/index.html").expect(200);
	});

	it("should reject file", async () => {
		await supertest(server)
			.get("/index.template.html")
			.expect(404);
		await supertest(server)
			.get("/vue-ssr-client-manifest.json")
			.expect(404);
	});

	it("should check only path", (done) => {
		supertest(server)
			.get("/foo.js.map?query=0#hash")
			.expect(404, done);
	});
});

