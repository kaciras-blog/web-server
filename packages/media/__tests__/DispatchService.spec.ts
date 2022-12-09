import { expect, it, vi } from "vitest";
import { BadDataError, LoadRequest, SaveRequest } from "../lib/index.js";
import DispatchService from "../lib/DispatchService.js";

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
	expect(service1.load).toHaveBeenCalledWith(loadRequest);
	expect(fallback.load).not.toHaveBeenCalled();
});

it("should dispatch save calls", () => {
	dispatcher.save(saveRequest);
	expect(service1.save).toHaveBeenCalledWith(saveRequest);
	expect(fallback.save).not.toHaveBeenCalled();
});

it("should load from fallback if no matched", () => {
	const request = { ...loadRequest, name: "baz.png" };
	dispatcher.load(request);

	expect(service1.load).not.toHaveBeenCalled();
	expect(fallback.load).toHaveBeenCalledWith(request);
});

it("should save from fallback if no matched", () => {
	const request = { ...saveRequest, type: "png" };
	dispatcher.save(request);

	expect(service1.save).not.toHaveBeenCalled();
	expect(fallback.save).toHaveBeenCalledWith(request);
});

it("should throw if no matched and no fallback",async () => {
	const instance = new DispatchService({});
	await expect(() => instance.load(loadRequest)).rejects.toThrow(BadDataError);
	await expect(() => instance.save(saveRequest)).rejects.toThrow(BadDataError);
});
