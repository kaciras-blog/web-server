import { randomBytes } from "crypto";
import { expect, it, vi } from "vitest";
import VariantService from "../lib/VariantService";
import { BadDataError } from "../lib/errors";
import { Data } from "../lib/FileStore";

const store = {
	putCache: vi.fn(),
	getCache: vi.fn(),
	save: vi.fn<[Data, string], any>(() => Promise.resolve(true)),
	load: vi.fn(),
};

const loadRequest = {
	name: "maoG0wFHmNhgAcMkRo1J.mp4",
	parameters: {},
	codecs: [],
	acceptTypes: [],
	acceptEncodings: [],
};

const service = new VariantService(store, ["av1", "webm"]);

it("should restrict codec", async () => {
	const saving = service.save({
		type: "mp4",
		parameters: {
			codec: "flv",
		},
		buffer: Buffer.alloc(0),
	});

	await expect(saving).rejects.toBeInstanceOf(BadDataError);
});

it("should save file", async () => {
	const request = {
		type: "mp4",
		parameters: {},
		buffer: Buffer.alloc(0),
	};

	const result = await service.save(request);
	expect(result).toBe("maoG0wFHmNhgAcMkRo1J.mp4");

	const { calls } = store.save.mock;
	expect(calls).toHaveLength(1);

	const [name, data] = calls[0];
	expect(data).toBe(request.buffer);
	expect(name).toBe("maoG0wFHmNhgAcMkRo1J.mp4");
});

it("should save variant", async () => {
	const name = await service.save({
		type: "mp4",
		parameters: {},
		buffer: Buffer.alloc(0),
	});

	const name2 = await service.save({
		type: "mp4",
		parameters: {
			codec: "av1",
			variant: name,
		},
		buffer: randomBytes(8),
	});

	expect(name2).toBe("maoG0wFHmNhgAcMkRo1J.av1.mp4");
});

// = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =

it("should return null when cannot found file", () => {
	store.load.mockResolvedValue(null);

	const promise = service.load({
		...loadRequest,
		codecs: ["av1", "webm"],
	});

	return expect(promise).resolves.toBeUndefined();
});

it("should give first matched variant", async () => {
	const stubFile = { size: 0, mtime: 0, data: "" };
	store.load.mockResolvedValueOnce(null);	// av1 没有
	store.load.mockResolvedValueOnce(stubFile);		// webm 有

	const result = await service.load({
		...loadRequest,
		codecs: ["av1", "webm"],
	});

	expect(result?.file).toBe(stubFile);
	expect(result?.type).toBe("mp4");

	const { calls } = store.load.mock;
	expect(calls).toHaveLength(2);
	expect(calls[1][0]).toBe("maoG0wFHmNhgAcMkRo1J.webm.mp4");
});

it("should fallback when no codec matched", async () => {
	const stubFile = { size: 0, mtime: 0, data: "" };
	store.load.mockResolvedValue(stubFile);

	const result = await service.load(loadRequest);

	expect(result?.file).toBe(stubFile);

	const { calls } = store.load.mock;
	expect(calls).toHaveLength(1);
	expect(calls[0][0]).toBe("maoG0wFHmNhgAcMkRo1J.mp4");
});
