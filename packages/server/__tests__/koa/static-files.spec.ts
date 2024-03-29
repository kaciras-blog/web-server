import { basename } from "path";
import fs from "fs";
import { describe, expect, it, vi } from "vitest";
import supertest from "supertest";
import Koa, { BaseContext } from "koa";
import { FIXTURE_DIR } from "../test-utils.js";
import serve from "../../lib/koa/static-files.js";

it("should serve from cwd when root = '.'", async () => {
	const app = new Koa();
	app.use(serve("."));

	await supertest(app.callback()).get("/package.json").expect(200);
});

it("should pass to next for directory", async () => {
	const app = new Koa();
	app.use(serve(FIXTURE_DIR));
	app.use(ctx => ctx.body = "hello");

	await supertest(app.callback())
		.get("/static")
		.expect(200, "hello");
});

describe("when path is not a file", () => {
	it("should 404", async () => {
		const app = new Koa();
		app.use(serve(FIXTURE_DIR));

		await supertest(app.callback()).get("/something").expect(404);
	});

	it("should not throw 404 error", async () => {
		let err: any = null;

		const app = new Koa();
		app.use((ctx, next) => next().catch(e => err = e));
		app.use(serve(FIXTURE_DIR));
		app.use((ctx) => ctx.body = "ok");

		const res = await supertest(app.callback()).get("/something").expect(200);

		expect(err).toBeNull();
		expect(res.text).toBe("ok");
	});
});

it("should prevent access for path outside root", async () => {
	const app = new Koa();
	app.use(serve(FIXTURE_DIR));

	await supertest(app.callback()).get("/../../package.json").expect(403);
});

it("should pass to next when method is not `GET` or `HEAD`", async () => {
	const app = new Koa();
	app.use(serve(FIXTURE_DIR));

	await supertest(app.callback()).post("/hello.txt").expect(404);
});

it("should 400 when path is malformed", async () => {
	const app = new Koa();
	app.use(serve(FIXTURE_DIR));

	await supertest(app.callback()).get("/%").expect(400);
});

it("should serve the file", async () => {
	const app = new Koa();
	app.use(serve(FIXTURE_DIR));
	app.use((ctx, next) => {
		return next().then(() => ctx.body = "hey");
	});

	await supertest(app.callback())
		.get("/hello.txt")
		.set("Accept-Encoding", "deflate, identity")
		.expect(200)
		.expect("Content-Length", "5")
		.expect("world");
});

it("should set the Content-Type", async () => {
	const app = new Koa();
	app.use(serve(FIXTURE_DIR));

	await supertest(app.callback())
		.get("/static/hello.json")
		.expect("Content-Type", /application\/json/);
});

it("should return .gz version when requested and if possible", async () => {
	const app = new Koa();
	app.use(serve(FIXTURE_DIR));

	await supertest(app.callback())
		.get("/hello.txt")
		.set("Accept-Encoding", "gzip, deflate")
		.expect(200)
		.expect("Content-Type", /text\/plain/)
		.expect("Content-Length", "25")
		.expect("Content-Encoding", "gzip");
});

it("should return .br version when requested and if possible", async () => {
	const app = new Koa();
	app.use(serve(FIXTURE_DIR));

	await supertest(app.callback())
		.get("/hello.txt")
		.set("Accept-Encoding", "gzip, deflate, br")
		.expect(200)
		.expect("Content-Type", /text\/plain/)
		.expect("Content-Length", "9")
		.expect("Content-Encoding", "br");
});

it("should return avif image if possible", async () => {
	const app = new Koa();
	app.use(serve(FIXTURE_DIR));

	await supertest(app.callback())
		.get("/static/image.png")
		.set("Accept", "image/webp,image/avif,*/*")
		.expect(200)
		.expect("Content-Type", /image\/avif/)
		.expect("Content-Length", "7114");
});

it("should return webp image if possible", async () => {
	const app = new Koa();
	app.use(serve(FIXTURE_DIR));

	await supertest(app.callback())
		.get("/static/image.png")
		.set("Accept", "image/webp,*/*")
		.expect(200)
		.expect("Content-Type", /image\/webp/)
		.expect("Content-Length", "5354");
});

describe("custom headers", () => {

	it("should accept ctx and path", async () => {
		const customResponse = vi.fn<[BaseContext, string, fs.Stats], void>();

		const app = new Koa();
		app.use(serve(FIXTURE_DIR, { customResponse }));

		await supertest(app.callback())
			.get("/hello.txt")
			.set("Accept-Encoding", "gzip, deflate, br")
			.expect(200);

		const call = customResponse.mock.calls[0];
		expect(call[0].path).toBe("/hello.txt");
		expect(basename(call[1])).toBe("hello.txt.br");
		expect(call[2].size).toBe(9);
	});

	it("should add custom headers", async () => {
		const app = new Koa();
		app.use(serve(FIXTURE_DIR, {
			customResponse(ctx) {
				ctx.set("Cache-Control", "public,max-age=666,immutable");
			},
		}));

		await supertest(app.callback())
			.get("/static/hello.json")
			.expect(200)
			.expect("Cache-Control", "public,max-age=666,immutable");
	});
});
