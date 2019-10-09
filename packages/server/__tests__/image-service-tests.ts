import { PreGenerateImageService } from "../lib/image-service";
import { runFilters } from "../lib/image-filter";
import { LocalFileSlot } from "../lib/image-store";

jest.mock("../image-filter");
(runFilters as jest.Mock).mockImplementation((buffer) => Promise.resolve(buffer));

const mockSlot = {
	getCache: jest.fn(),
};

function mockStore(ignore: string) {
	return mockSlot as unknown as LocalFileSlot;
}

describe("get", () => {
	const service = new PreGenerateImageService(mockStore as any);
	
	it("should short-circuit", async () => {
		mockSlot.getCache.mockResolvedValue("image file");

		await service.get("test", "svg", true, true);
		expect(mockSlot.getCache.mock.calls).toHaveLength(1);
	});

	it("should return candidates", async () => {
		mockSlot.getCache
			.mockResolvedValueOnce(null)
			.mockResolvedValue("image file");

		await service.get("test", "svg", true, true);
		expect(mockSlot.getCache.mock.calls).toHaveLength(2);
	});
});
