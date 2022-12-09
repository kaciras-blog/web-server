import { describe, expect, it, vi } from "vitest";
import supertest from "supertest";
import Koa from "koa";
import multer from "@koa/multer";
import { BadDataError, ParamsError } from "@kaciras-blog/media";
import { download, DownloadContext, upload } from "../../lib/koa/media.js";

vi.mock("fs");

const FILE_PATH = "/photo.png";
const IMAGE_DATA = Buffer.from("R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==", "base64");

const file = {
	size: IMAGE_DATA.length,
	data: IMAGE_DATA,
	mtime: new Date(),
};

const mockService = {
	load: vi.fn(),
	save: vi.fn(),
};

describe("download", () => {
	const app = new Koa();
	app.use((ctx, next) => {
		ctx.params = { name: ctx.path.substring(1) };
		return next();
	});
	app.use((ctx: DownloadContext) => download(mockService as any, ctx));
	const callback = app.callback();

	it("should response image", async () => {
		mockService.load.mockResolvedValue({ file, type: "png" });

		await supertest(callback)
			.get(FILE_PATH)
			.expect(200)
			.expect("Content-Type", "image/png")
			.expect(Buffer.from(IMAGE_DATA));
	});

	it("should fail on non exists file", async () => {
		mockService.load.mockResolvedValue(null);

		await supertest(callback)
			.get("/notfound.jpg")
			.expect(404);

		expect(mockService.load).toHaveBeenCalledOnce();
	});

	it("should resolve Accept-* headers", async () => {
		mockService.load.mockResolvedValue(null);

		await supertest(callback)
			.get("/notfound.jpg")
			.set("Accept", "image/webp,*/*")
			.set("Accept-Encoding", "gzip, deflate, br")
			.expect(404);

		const { acceptTypes, acceptEncodings, codecs } = mockService.load.mock.calls[0][0];
		expect(codecs).toStrictEqual([]);
		expect(acceptTypes).toStrictEqual(["webp"]);
		expect(acceptEncodings).toStrictEqual(["gzip", "deflate", "br"]);
	});

	it("should set Content-Encoding", async () => {
		mockService.load.mockResolvedValue({ file, type: "png", encoding: "br" });

		await supertest(callback)
			.get(FILE_PATH)
			.expect(200)
			.expect("Content-Encoding", "br")
			.expect(IMAGE_DATA);
	});

	it("should resolve codecs parameter", async () => {
		mockService.load.mockResolvedValue(null);

		await supertest(callback)
			.get("/notfound.jpg?codecs=hevc,av1,vp9")
			.set("Accept", "video/*,*/*")
			.expect(404);

		const { codecs } = mockService.load.mock.calls[0][0];
		expect(codecs).toStrictEqual(["hevc", "av1", "vp9"]);
	});
});

describe("upload", () => {
	const app = new Koa();
	app.use(multer().single("file"));
	app.use((ctx) => upload(mockService as any, ctx));

	const callback = app.callback();

	it("should save a new file", async () => {
		mockService.save.mockResolvedValueOnce("saved_file_name");

		await supertest(callback)
			.post("/image?foo=bar&foo=s")
			.attach("file", IMAGE_DATA, { filename: "test.gif", contentType: "image/gif" });

		expect(mockService.save).toHaveBeenCalledWith({
			type: "gif",
			buffer: IMAGE_DATA,
			parameters: { foo: "bar" },
		});
	});

	it("should respond file path", async () => {
		mockService.save.mockResolvedValueOnce("saved_file_name");

		await supertest(callback)
			.post("/image")
			.attach("file", IMAGE_DATA, { filename: "test.gif", contentType: "image/gif" })
			.expect(200)
			.expect("Location", "/image/saved_file_name");
	});

	it("should fail without file entity", async () => {
		await supertest(callback)
			.post("/image")
			.expect(400);

		expect(mockService.save).not.toHaveBeenCalled();
	});

	it("should fail with unsupported file type", async () => {
		mockService.save.mockRejectedValue(new BadDataError());

		await supertest(callback)
			.post("/image")
			.attach("file", IMAGE_DATA, { filename: "test.gif", contentType: "text/json" })
			.expect(400);
	});

	it("should fail on MediaError", async () => {
		mockService.save.mockRejectedValueOnce(new ParamsError());

		await supertest(callback)
			.post("/image")
			.attach("file", IMAGE_DATA, { filename: "test.gif", contentType: "image/gif" })
			.expect(400);
	});

	it("should throw on non-media errors", async () => {
		mockService.save.mockRejectedValueOnce(new Error("Mocked error"));

		await supertest(callback)
			.post("/image")
			.attach("file", IMAGE_DATA, { filename: "test.gif", contentType: "image/gif" })
			.expect(500);
	});
});
