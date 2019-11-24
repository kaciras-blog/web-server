import supertest from "supertest";
import Koa from "koa";
import { RenderContext, renderPage } from "../lib/ssr-middleware";

const renderFn = jest.fn<Promise<string>, [RenderContext]>(() => Promise.resolve("test content"));

const koa = new Koa();
koa.use((ctx) => renderPage({ renderToString: renderFn } as any, ctx));
const callback = koa.callback();

it("should pass render context", async () => {
	const request = supertest(callback).get("/test?a=b");
	await request.expect(200);

	const context = renderFn.mock.calls[0][0];
	expect(context.url.toString()).toBe(request.url);
});

it("should perform custom redirect", () => {
	renderFn.mockRejectedValueOnce(Object.assign(new Error(), { code: 302, location: "/redirected" }));
	return supertest(callback).get("/test?a=b")
		.expect(302)
		.expect("Location", "/redirected");
});

it("should redirect to error page", async () => {
	renderFn.mockRejectedValueOnce(new Error());
	const request = supertest(callback).get("/test?a=b");
	await request.expect(503);

	const context = renderFn.mock.calls[1][0];
	expect(context.url.pathname).toBe("/error/500");
	expect(context.url.search).toBe("");
});

// createSSRProductionPlugin() 不测了，就是一个便捷的封装方法。
