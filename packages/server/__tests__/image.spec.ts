import fs from "fs-extra";
import Koa, { Context } from "koa";
import multer from "@koa/multer";
import supertest from "supertest";
import { FilterArgumentError } from "@kaciras-blog/image/lib/errors";
import { DownloadContext, downloadImage, route, uploadImage } from "../lib/koa/image";

jest.mock("fs");

const FILE_PATH = "/photo.png";
const IMAGE_DATA = Buffer.from("R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==", "base64");

const mockService = {
	get: jest.fn(),
	save: jest.fn(),
};

describe("downloadImage", () => {
	const app = new Koa();
	app.use((ctx, next) => {
		ctx.params = { name: ctx.path.substring(1) };
		return next();
	});
	app.use((ctx: DownloadContext) => downloadImage(mockService as any, ctx));
	const callback = app.callback();

	it("should response image", async () => {
		mockService.get.mockResolvedValueOnce({ path: FILE_PATH });
		fs.writeFileSync(FILE_PATH, IMAGE_DATA);

		await supertest(callback)
			.get(FILE_PATH)
			.expect(200)
			.expect(Buffer.from(IMAGE_DATA));

		const args = mockService.get.mock.calls[0];
		expect(args[2]).toBe(false);
		expect(args[3]).toBe(false);
	});

	it("should fail on non exists file", async () => {
		await supertest(callback)
			.get("/notfound.jpg")
			.expect(404);
		expect(mockService.get.mock.calls).toHaveLength(1);
	});

	it("should resolve Accept-* headers", async () => {
		await supertest(callback)
			.get("/notfound.jpg")
			.set("Accept", "image/webp,*/*")
			.set("Accept-Encoding", "gzip, deflate, br")
			.expect(404);

		const args = mockService.get.mock.calls[0];
		expect(args[2]).toBe(true);
		expect(args[3]).toBe(true);
	});

	it("should set Content-Encoding", async () => {
		mockService.get.mockResolvedValueOnce({ path: FILE_PATH, encoding: "br" });
		fs.writeFileSync(FILE_PATH, IMAGE_DATA);

		await supertest(callback)
			.get(FILE_PATH)
			.expect(200)
			.expect("Content-Encoding", "br")
			.expect(Buffer.from(IMAGE_DATA));
	});
});

describe("uploadImage", () => {

	const app = new Koa();
	const uploader = multer({ limits: { fileSize: 4 * 1024 * 1024 } });

	app.use(uploader.single("file"));
	app.use((ctx) => uploadImage(mockService as any, ctx));

	const callback = app.callback();

	it("should save a new file", async () => {
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
		expect(mockService.save.mock.calls).toHaveLength(0);
	});

	it("should fail with unsupported file type", async () => {
		await supertest(callback)
			.post("/image")
			.attach("file", IMAGE_DATA, { filename: "test.gif", contentType: "text/json" })
			.expect(400);
		expect(mockService.save.mock.calls).toHaveLength(0);
	});

	it("should fail on InputDataError", async () => {
		mockService.save.mockRejectedValueOnce(new FilterArgumentError());

		await supertest(callback)
			.post("/image")
			.attach("file", IMAGE_DATA, { filename: "test.gif", contentType: "image/gif" })
			.expect(400);
	});

	it("should throw on other errors", async () => {
		mockService.save.mockRejectedValueOnce(new Error());

		await supertest(callback)
			.post("/image")
			.attach("file", IMAGE_DATA, { filename: "test.gif", contentType: "image/gif" })
			.expect(500);
	});
});

describe("route", () => {
	const downloadFn = jest.fn();
	const uploadFn = jest.fn<void, [Context]>((ctx) => ctx.status = 200);

	const app = new Koa();
	app.use(route("/image", downloadFn, uploadFn));
	app.use((ctx) => ctx.status = 418);
	const callback = app.callback();

	it("should route to downloadFn", async () => {
		await supertest(callback).get("/image/photo.png");
		const ctx = downloadFn.mock.calls[0][0];
		expect(ctx.params.name).toBe("photo.png");
	});

	it("should route to uploadFn", async () => {
		await supertest(callback).post("/image").expect(200);
		expect(uploadFn.mock.calls).toHaveLength(1);
	});

	it("should fail with invalid method", async () => {
		await supertest(callback)
			.patch("/image")
			.expect(405);
		expect(uploadFn.mock.calls).toHaveLength(0);
	});

	it("should fail with invalid path", async () => {
		await supertest(callback)
			.get("/image/../secret_file.jpg")
			.expect(404);
		expect(uploadFn.mock.calls).toHaveLength(0);
	});

	it("should fail without filename", async () => {
		await supertest(callback)
			.get("/image")
			.expect(404);
		await supertest(callback)
			.get("/image/")
			.expect(404);
		expect(downloadFn.mock.calls).toHaveLength(0);
	});

	it("should fail on post to sub-path", async () => {
		await supertest(callback)
			.post("/image/abc")
			.expect(404);
		expect(uploadFn.mock.calls).toHaveLength(0);
	});

	it("should delegate not concerned to next", () => {
		return supertest(callback).get("/another").expect(418);
	});
});
