import VideoService from "../lib/VideoService";
import { FileStore } from "../lib/FileStore";

const mockStore: FileStore = {
	save: jest.fn(),
	load: jest.fn(),
	putCache: jest.fn(),
	getCache: jest.fn(),
};

it("should restrict file type", async () => {
	const service = new VideoService(mockStore);
	const rv = await service.save({
		rawName: "test",
		buffer: Buffer.alloc(10),
		mimetype: "",
		parameters: {},
	});
	expect(rv.url).toBe("");
});

it("should save variant", () => {

});
