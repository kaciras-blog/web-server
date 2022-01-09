import { readFixture } from "../test-utils";
import RasterOptimizer from "../../lib/image/RasterOptimizer";
import { BadDataError } from "../../lib/errors";
import { crop } from "../../lib/image/param-processor";

jest.mock("../../lib/image/param-processor");

const store = {
	save: jest.fn(),
	load: jest.fn(),
	putCache: jest.fn(),
	getCache: jest.fn(),
};

const baseRequest = Object.freeze({
	buffer: readFixture("tile_16x16.png"),
	type: "png",
	parameters: {},
});

const optimizer = new RasterOptimizer(store);

test.each(
	["jp2", "html", "", "../.."],
)("should restrict file type %#", (type) => {
	const promise = optimizer.check({
		type,
		parameters: {},
		buffer: Buffer.alloc(0),
	});

	return expect(promise).rejects.toThrow(BadDataError);
});

it("should normalize type", async () => {
	const request = {
		...baseRequest,
		type: "jpeg",
	};
	await optimizer.check(request);
	expect(request.type).toBe("jpg");
});

it("should crop the image", async () => {
	const cropped = Buffer.alloc(0);
	const fn = crop as jest.Mock;
	fn.mockReturnValue({
		toBuffer() { return cropped; },
	});
	const request = {
		...baseRequest,
		parameters: { crop: "foobar" },
	};

	await optimizer.check(request);

	expect(request.buffer).toBe(cropped);
	expect(fn.mock.calls[0][1]).toBe("foobar");
});
