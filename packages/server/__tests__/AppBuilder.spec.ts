import { Context, Next } from "koa";
import supertest from "supertest";
import AppBuilder from "../lib/AppBuilder";

it("should add middleware in order", async () => {
	const calls: number[] = [];

	function mockMiddleware(index: number) {
		return async (_: Context, next: Next) => {
			calls.push(index);
			await next();
			calls.push(index);
		};
	}

	const builder = new AppBuilder();
	builder.useBeforeAll(mockMiddleware(0));
	builder.useBeforeFilter(mockMiddleware(1));
	builder.useFilter(mockMiddleware(2));
	builder.useResource(mockMiddleware(3));
	builder.useFallBack(mockMiddleware(4));

	const app = builder.build();
	await supertest(app.callback())
		.get("/")
		.expect(404);

	expect(calls).toStrictEqual([0, 1, 2, 3, 4, 4, 3, 2, 1, 0]);
});

it("should avoid multiple fallback", () => {
	const builder = new AppBuilder();
	builder.useFallBack(jest.fn());

	expect(() => builder.useFallBack(jest.fn())).toThrow();
});
