import { describe, expect, it, vi } from "vitest";
import CachedService from "../lib/CachedService";

const optimizer = {
	check: vi.fn(),
	buildCache: vi.fn(),
	select: vi.fn(),
};

const store = {
	list: vi.fn(),
	save: vi.fn(),
	load: vi.fn(),
	putCaches: vi.fn(),
	getCache: vi.fn(),
	listCache: vi.fn(),
};

const loadRequest = {
	name: "maoG0wFHmNhgAcMkRo1J.png",
	parameters: {},
	codecs: [],
	acceptTypes: [],
	acceptEncodings: [],
};

const loadResponse = {
	type: "webp",
	file: {
		data: "foobar",
		mtime: new Date(),
		size: 123456,
	},
};

const service = new CachedService(store, optimizer);

describe("load", () => {
	it("should return null if no original file with type=origin", async () => {
		store.load.mockResolvedValueOnce(null);

		const result = await service.load({
			...loadRequest,
			parameters: { type: "origin" },
		});

		expect(result).toBeNull();

		expect(optimizer.select.mock.calls).toHaveLength(0);
		expect(store.load.mock.calls).toHaveLength(1);
	});

	it("should return the original file if specified", async () => {
		store.load.mockResolvedValueOnce(loadResponse.file);

		const result = await service.load({
			...loadRequest,
			parameters: { type: "origin" },
		});

		expect(result!.file).toBe(loadResponse.file);
		expect(result!.type).toBe("png");

		expect(optimizer.select.mock.calls).toHaveLength(0);
		expect(store.load.mock.calls).toHaveLength(1);
	});

	it("should return only cached by default", async () => {
		const result = await service.load({
			...loadRequest,
			parameters: {},
		});

		expect(result).toBeNull();
		expect(optimizer.select.mock.calls).toHaveLength(1);
		expect(store.load.mock.calls).toHaveLength(0);
	});

	it("should get cache list to select", async () => {
		const attrsList = [
			{ type: "webp" },
			{ type: "png" },
			{ type: "avif" },
		];
		store.listCache.mockResolvedValue(attrsList);
		optimizer.select.mockReturnValue({ type: "webp" });

		await service.load(loadRequest);

		const [items, req] = optimizer.select.mock.calls[0];
		expect(items).toBe(attrsList);
		expect(req).toBe(loadRequest);
	});

	it("should get file from cache", async () => {
		store.getCache.mockResolvedValue(loadResponse.file);
		optimizer.select.mockReturnValue({ type: "webp" });

		const result = await service.load(loadRequest);

		expect(result).toStrictEqual(loadResponse);

		const [hash, attrs] = store.getCache.mock.calls[0];
		expect(hash).toBe("maoG0wFHmNhgAcMkRo1J");
		expect(attrs).toStrictEqual({ type: "webp" });
	});
});

describe("save", () => {
	it("should skip build cache if already saved", async () => {
		store.save.mockResolvedValue(false);

		const result = await service.save({
			type: "png",
			parameters: {},
			buffer: Buffer.alloc(0),
		});

		expect(result).toBe("maoG0wFHmNhgAcMkRo1J.png");
		expect(store.save.mock.calls).toHaveLength(1);
		expect(optimizer.buildCache.mock.calls).toHaveLength(0);
	});

	it("should build cache for new file", async () => {
		const cacheItems = [
			{ data: "123", params: { type: "png" } },
			{ data: "456", params: { type: "avif" } },
		];
		optimizer.buildCache.mockResolvedValue(cacheItems);
		store.save.mockResolvedValue(true);

		const result = await service.save({
			type: "png",
			parameters: {},
			buffer: Buffer.alloc(0),
		});

		expect(result).toBe("maoG0wFHmNhgAcMkRo1J.png");
		expect(optimizer.buildCache.mock.calls).toHaveLength(1);
		expect(store.putCaches.mock.calls).toHaveLength(1);
	});
});
