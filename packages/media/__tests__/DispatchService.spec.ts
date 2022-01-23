import { expect, it, vi } from "vitest";
import DispatchService from "../lib/DispatchService";
import { LoadRequest, SaveRequest } from "../lib/MediaService";
import { BadDataError } from "../lib/errors";

const service1 = {
	load: vi.fn(),
	save: vi.fn(),
};

const fallback = {
	load: vi.fn(),
	save: vi.fn(),
};

const dispatcher = new DispatchService({ svg: service1 }, fallback);

const loadRequest: LoadRequest = {
	name: "foobar.svg",
	parameters: {},
	codecs: [],
	acceptEncodings: [],
	acceptTypes: [],
};

const saveRequest: SaveRequest = {
	type: "svg",
	parameters: {},
	buffer: Buffer.alloc(0),
};

it("should dispatch load calls", () => {
	dispatcher.load(loadRequest);
	expect(service1.load.mock.calls[0][0]).toBe(loadRequest);
	expect(fallback.load.mock.calls).toHaveLength(0);
});

it("should dispatch save calls", () => {
	dispatcher.save(saveRequest);
	expect(service1.save.mock.calls[0][0]).toBe(saveRequest);
	expect(fallback.save.mock.calls).toHaveLength(0);
});

it("should load from fallback if no matched", () => {
	const request = { ...loadRequest, name: "baz.png" };
	dispatcher.load(request);
	expect(service1.load.mock.calls).toHaveLength(0);
	expect(fallback.load.mock.calls[0][0]).toBe(request);
});

it("should save from fallback if no matched", () => {
	const request = { ...saveRequest, type: "png" };
	dispatcher.save(request);
	expect(service1.save.mock.calls).toHaveLength(0);
	expect(fallback.save.mock.calls[0][0]).toBe(request);
});

it("should throw if no matched and no fallback",async () => {
	const instance = new DispatchService({});
	await expect(() => instance.load(loadRequest)).rejects.toThrow(BadDataError);
	await expect(() => instance.save(saveRequest)).rejects.toThrow(BadDataError);
});
