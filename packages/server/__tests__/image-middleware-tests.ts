import { downloadImage, route, uploadImage } from "../lib/image-middleware";
import fs from "fs-extra";
import Koa from "koa";
import supertest from "supertest";
import multer from "@koa/multer";

jest.mock("fs");

const FILE_PATH = "/valid_file.png";
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
	app.use((ctx) => downloadImage(mockService as any, ctx));
	const callback = app.callback();

	it("should response image", async () => {
		mockService.get.mockResolvedValueOnce({ path: FILE_PATH });
		fs.writeFileSync(FILE_PATH, IMAGE_DATA);

		await supertest(callback)
			.get(FILE_PATH)
			.expect(200)
			.expect(Buffer.from(IMAGE_DATA));
	});

	it("should fail on non exists file", async () => {
		await supertest(callback)
			.get("/notfound.jpg")
			.expect(404);
		expect(mockService.get.mock.calls).toHaveLength(1);
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
});

describe("route", () => {
	const downloadFn = jest.fn();
	const uploadFn = jest.fn();

	const app = new Koa();
	app.use(route("/image", downloadFn, uploadFn));
	app.use((ctx) => ctx.status = 418);
	const callback = app.callback();

	it("should fail with invalid method", async () => {
		await supertest(callback)
			.patch("/image")
			.expect(405);
		expect(uploadFn.mock.calls).toHaveLength(0);
	});

	it("should fail without filename", async () => {
		await supertest(callback)
			.get("/image")
			.expect(404);
		await supertest(callback)
			.get("/image/")
			.expect(404);
		expect(downloadFn.mock.calls.length).toBe(0);
	});

	it("should delegate not concerned to next", () => {
		return supertest(callback).get("/another").expect(418);
	});
});
