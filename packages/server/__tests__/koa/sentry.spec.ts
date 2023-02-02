import { afterAll, beforeAll, expect, it } from "vitest";
import Koa from "koa";
import supertest from "supertest";
import { getLocal } from "mockttp";
import bodyParser from "koa-bodyparser";
import sentryTunnel from "../../lib/koa/sentry.js";

const mockRemote = getLocal();
beforeAll(() => mockRemote.start());
afterAll(() => mockRemote.stop());

it("should forward the request", async () => {
	const DSN = `http://foo@localhost:${mockRemote.port}/114514`;

	const envelope =
		`{"sent_at":"2023-02-02T09:10:53.601Z","sdk":{"name":"sentry.javascript.vue","version":"7.33.0"},"dsn":"${DSN}"}\n` +
		'{"type":"session"}\n' +
		'{"sid":"4b2e8572e0a840e1a9625672f72aea1d","init":true }';

	const ep = await mockRemote
		.forPost("/api/114514/envelope/")
		.thenReply(200, "{}");

	const app = new Koa();
	app.proxy = true;

	app.use(bodyParser({ enableTypes: ["text"] }));
	app.use(sentryTunnel(DSN));
	const callback = app.callback();

	await supertest(callback)
		.post("/sentry")
		.set("Content-Type", "text/plain")
		.set("X-Forwarded-For", "12.34.56.78")
		.send(envelope)
		.expect(200, "{}");

	const [request] = await ep.getSeenRequests();
	expect(request.headers["x-forwarded-for"]).toBe("12.34.56.78");
});
