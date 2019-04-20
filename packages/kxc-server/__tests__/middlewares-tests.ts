import Koa from "koa";
import { intercept } from "../middlewares";
import supertest from "supertest";


describe("intercept middleware", () => {
	const app = new Koa();
	app.use(intercept([
		new RegExp("^/(?:index\\.template|vue-ssr)"),
		new RegExp("\\.(?:js|css)\\.map$"),
	]));
	app.use((ctx) => ctx.status = 200);
	const server = app.listen();

	it("should accept", (done) => {
		supertest(server)
			.get("/foo.js")
			.expect(200, done);
	});

	it("should reject file", (done) => {
		supertest(server)
			.get("/vue-ssr-client-manifest.json")
			.expect(404, done);
	});

	it("should check only path", (done) => {
		supertest(server)
			.get("/foo.js.map?query=0#hash")
			.expect(404, done);
	});

	afterAll((done) => server.close(done));
});

