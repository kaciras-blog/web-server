import { performance } from "perf_hooks";
import Koa, { Context } from "koa";
import serve from "koa-static";
import supertest from "supertest";
import staticFiles from "../lib/koa/static-files.js";

/*
 * 测试结果显示两者差距不大，并且都很快，不太可能成为性能瓶颈。
 */
const sf = staticFiles("../__tests__");
const ks = serve("../__tests__", { maxAge: 31536000 });

async function test(name: string, func: any) {

	async function iter() {
		for (let i = 0; i < 1000; i++) await func();
	}

	// warm up
	await iter();
	await iter();
	await iter();
	await iter();
	await iter();

	const start = performance.now();
	await Promise.all([iter(), iter(), iter(), iter(), iter()]);
	const end = performance.now();

	console.log("\n" + name);
	console.log(`${(end - start).toFixed(2)} ms`);
}

/**
 * Context属性多，自己创建麻烦，直接模拟请求一下。
 */
function getContext() {
	let mockContext: Context;
	const app = new Koa();
	app.use(ctx => mockContext = ctx);

	return supertest(app.callback())
		.get("/static/hello.json")
		.set("Accept-Encoding", "gzip, deflate, br")
		.then(() => mockContext);
}

async function run() {
	const ctx = await getContext();
	const next = async () => {};

	await test("myImpl", () => sf(ctx, next));
	await test("KoaStatic", () => ks(ctx, next));
}

run().catch(e => console.error(e));
