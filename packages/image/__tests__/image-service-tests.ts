import path from "path";
import fs from "fs-extra";
import { PreGenerateImageService } from "../lib/image-service";
import { runFilters } from "../lib/filter-runner";
import { LocalFileSlot } from "../lib/image-store";

jest.mock("../lib/filter-runner");
(runFilters as jest.Mock).mockImplementation((buffer) => Promise.resolve(buffer));

const mockSlot = {
	exists: jest.fn(),
	save: jest.fn(() => Promise.resolve()),
	getCache: jest.fn(),
	putCache: jest.fn(),
};

function mockStore(ignore: string) {
	return mockSlot as unknown as LocalFileSlot;
}

describe("get", () => {
	const service = new PreGenerateImageService(mockStore as any);

	it("should short-circuit", async () => {
		mockSlot.getCache.mockResolvedValue("image file");

		await service.get("test", "svg", { brotli: true });
		expect(mockSlot.getCache.mock.calls).toHaveLength(1);
	});

	it("should return candidates", async () => {
		mockSlot.getCache
			.mockResolvedValueOnce(null)
			.mockResolvedValue("image file");

		await service.get("test", "svg", { brotli: true });
		expect(mockSlot.getCache.mock.calls).toHaveLength(2);
	});
});

describe("save", () => {

	// 怎么测试结果是无损的？
	it("should optimize SVG", async () => {
		const service = new PreGenerateImageService(mockStore as any);
		const buffer = await fs.readFile(path.join(__dirname, "fixtures", "digraph.svg"));

		mockSlot.exists.mockResolvedValue(false);
		await service.save(buffer, "svg");

		expect(mockSlot.putCache.mock.calls).toHaveLength(2);
	});
});
