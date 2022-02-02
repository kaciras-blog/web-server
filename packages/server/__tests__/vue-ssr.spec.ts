import { expect, it, vi } from "vitest";
import supertest from "supertest";
import Koa from "koa";
import { RenderContext, renderSSR } from "../lib/koa/vue-ssr";

const entry = vi.fn<[RenderContext]>(async () => "<p>bar</p>");

const koa = new Koa();
koa.use(ctx => renderSSR(ctx, "<div>foo</div>", entry, {}));
const callback = koa.callback();

it("should pass the render context", async () => {
	await supertest(callback).get("/test?a=b");

	const [context] = entry.mock.calls[0];
	expect(context.path).toBe("/test?a=b");
	expect(context.status).toBeUndefined();
	expect(context.error).toBeUndefined();
	expect(context.template).toBe("<div>foo</div>");
	expect(context.manifest).toStrictEqual({});
});

it("should render the page", async () => {
	const request = supertest(callback).get("/test?a=b");
	await request
		.expect("Content-Type", /text\/html/)
		.expect(200, "<p>bar</p>");
});

it("should support set status", async () => {
	entry.mockImplementationOnce(async ctx => {
		ctx.status = 418;
		return "<span>baz</span>";
	});
	await supertest(callback)
		.get("/test")
		.expect(418, "<span>baz</span>");
});

it("should perform custom redirect", async () => {
	entry.mockRejectedValueOnce(Object.assign(new Error(), { code: 302, location: "/redirected" }));
	await supertest(callback).get("/test?a=b")
		.expect(302)
		.expect("Location", "/redirected");
});

it("should render error page on error occurred", async () => {
	const error = new Error();
	entry.mockRejectedValueOnce(error);
	entry.mockResolvedValueOnce("Test Error");

	await supertest(callback)
		.get("/test?a=b")
		.expect(503, "Test Error");

	expect(entry.mock.calls).toHaveLength(2);

	const [context] = entry.mock.calls[1];
	expect(context.path).toBe("/test?a=b");
	expect(context.error).toBe(error);
	expect(context.status).toBeUndefined();
});

// createSSRProductionPlugin() 不测了，就是一个便捷的封装方法。
