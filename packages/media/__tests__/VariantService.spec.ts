import { randomBytes } from "crypto";
import VariantService from "../lib/VariantService";
import { BadDataError } from "../lib/errors";
import { Data } from "../lib/FileStore";

const store = {
	putCache: jest.fn(),
	getCache: jest.fn(),
	save: jest.fn<any, [Data, string]>(() => Promise.resolve(true)),
	load: jest.fn(),
};

const service = new VariantService(store, ["av1", "webm"]);

it("should restrict file type", async () => {
	const saving = service.save({
		mimetype: "text/html",
		parameters: {},
		buffer: Buffer.alloc(0),
	});

	await expect(saving).rejects.toBeInstanceOf(BadDataError);
});

it("should restrict codec", async () => {
	const saving = service.save({
		mimetype: "video/mp4",
		parameters: {
			codec: "flv",
		},
		buffer: Buffer.alloc(0),
	});

	await expect(saving).rejects.toBeInstanceOf(BadDataError);
});

it("should save file", async () => {
	const request = {
		mimetype: "video/mp4",
		parameters: {},
		buffer: Buffer.alloc(0),
	};

	const result = await service.save(request);
	expect(result.url).toBe("maoG0wFHmNhgAcMkRo1J.mp4");

	const { calls } = store.save.mock;
	expect(calls).toHaveLength(1);

	const [data, name] = calls[0];
	expect(data).toBe(request.buffer);
	expect(name).toBe("maoG0wFHmNhgAcMkRo1J.mp4");
});

it("should save variant", async () => {
	const saving = await service.save({
		mimetype: "video/mp4",
		parameters: {},
		buffer: Buffer.alloc(0),
	});

	const saving2 = await service.save({
		mimetype: "video/mp4",
		parameters: {
			codec: "av1",
			variant: saving.url,
		},
		buffer: randomBytes(8),
	});

	expect(saving2.url).toBe("maoG0wFHmNhgAcMkRo1J.av1");
});

// = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =

it("should return null when cannot found file", () => {
	store.load.mockResolvedValue(null);

	const promise = service.load({
		name: "maoG0wFHmNhgAcMkRo1J.mp4",
		parameters: {},
		acceptTypes: ["*/*"],
		acceptEncodings: [],
		codecs: ["av1", "webm"],
	});

	return expect(promise).resolves.toBeUndefined();
});

it("should give first matched variant", async () => {
	const stubFile = { size: 0, mtime: 0, data: "" };
	store.load.mockResolvedValueOnce(null);	// av1 没有
	store.load.mockResolvedValueOnce(stubFile);		// webm 有

	const result = await service.load({
		name: "maoG0wFHmNhgAcMkRo1J.mp4",
		parameters: {},
		acceptTypes: ["*/*"],
		acceptEncodings: [],
		codecs: ["av1", "webm"],
	});

	expect(result?.file).toBe(stubFile);
	expect(result?.mimetype).toBe("video/mp4");

	const { calls } = store.load.mock;
	expect(calls).toHaveLength(2);
	expect(calls[1][0]).toBe("maoG0wFHmNhgAcMkRo1J.webm");
});

it("should fallback when no codec matched", async () => {
	const stubFile = { size: 0, mtime: 0, data: "" };
	store.load.mockResolvedValue(stubFile);

	const result = await service.load({
		name: "maoG0wFHmNhgAcMkRo1J.mp4",
		parameters: {},
		acceptTypes: ["*/*"],
		acceptEncodings: [],
		codecs: [],
	});

	expect(result?.file).toBe(stubFile);

	const { calls } = store.load.mock;
	expect(calls).toHaveLength(1);
	expect(calls[0][0]).toBe("maoG0wFHmNhgAcMkRo1J.mp4");
});
