import { afterEach, describe, expect, it, vi } from "vitest";
import Koa from "koa";
import supertest from "supertest";
import { heapSnapshot, runGC, v8Statistics } from "../../lib/koa/diagnostics";

describe("heapSnapshot", () => {
	it("should task heap snapshot", () => {
		const callback = new Koa().use(heapSnapshot).callback();

		return supertest(callback).get("/")
			.expect(200)
			.expect("Content-Type", "application/octet-stream")
			.expect("content-disposition", 'attachment; filename="dump.heapsnapshot"')
			.expect(r => r.setEncoding("utf8").read(12) === '{"snapshot":');
	});
});

describe("runGC", () => {
	afterEach(() => void delete globalThis.gc);

	it("should run Garbage Collector", async () => {
		const callback = new Koa().use(runGC).callback();
		globalThis.gc = vi.fn();

		await supertest(callback).get("/").expect(202);
		expect(globalThis.gc).toHaveBeenCalledOnce();
	});

	it("should return 520 when gc() is not available", () => {
		const callback = new Koa().use(runGC).callback();
		return supertest(callback).get("/").expect(520);
	});
});

describe("v8Statistics", () => {
	it("should get V8 statistics", async () => {
		const callback = new Koa().use(v8Statistics).callback();

		const response = await supertest(callback)
			.get("/")
			.expect(200)
			.expect("Content-Type", "application/json; charset=utf-8");

		const { code, heap, spaces } = response.body;
		expect(spaces.length).toBeGreaterThan(1);
		expect(code.code_and_metadata_size).toBeGreaterThan(1000);
		expect(heap.total_heap_size).toBeGreaterThan(1000);
	});
});
