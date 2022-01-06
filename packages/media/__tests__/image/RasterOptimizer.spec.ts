import RasterOptimizer from "../../lib/image/RasterOptimizer";
import { BadDataError } from "../../lib/errors";

const store = {
	save: jest.fn(),
	load: jest.fn(),
	putCache: jest.fn(),
	getCache: jest.fn(),
};

const optimizer = new RasterOptimizer(store);

test.each(
	["image/jp2", "text/html", "", "invalid"],
)("should restrict file type %#", (mimetype) => {
	const promise = optimizer.check({
		mimetype,
		parameters: {},
		buffer: Buffer.alloc(0),
	});

	return expect(promise).rejects.toThrow(BadDataError);
});
