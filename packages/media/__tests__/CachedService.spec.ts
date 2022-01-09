import CachedService, { Optimizer } from "../lib/CachedService";
import MockedObject = jest.MockedObject;

const optimizer: MockedObject<Optimizer> = {
	check: jest.fn(),
	buildCache: jest.fn(),
	getCache: jest.fn(),
};

const store = {
	save: jest.fn(),
	load: jest.fn(),
	putCache: jest.fn(),
	getCache: jest.fn(),
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
	it("should return the original image if specified", async () => {
		await service.load({
			...loadRequest,
			parameters: { type: "origin" },
		});

		expect(store.load.mock.calls).toHaveLength(1);
		expect(optimizer.getCache.mock.calls).toHaveLength(0);
	});

	it("should return null if not exists", async () => {
		const result = await service.load(loadRequest);

		expect(result).toBeUndefined();
		expect(store.load.mock.calls).toHaveLength(0);
		expect(optimizer.getCache.mock.calls).toHaveLength(1);
	});

	it("should get file from cache", async () => {
		optimizer.getCache.mockResolvedValue(loadResponse);

		const result = await service.load(loadRequest);

		expect(result).toBe(loadResponse);
		expect(store.load.mock.calls).toHaveLength(0);
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
		store.save.mockResolvedValue(true);

		const result = await service.save({
			type: "png",
			parameters: {},
			buffer: Buffer.alloc(0),
		});

		expect(result).toBe("maoG0wFHmNhgAcMkRo1J.png");
		expect(optimizer.buildCache.mock.calls).toHaveLength(1);
	});
});
