import { createImageMiddleware } from "../image-service";
import fs from "fs-extra";
import crypto from "crypto";
import Koa from "koa";
import supertest from "supertest";
import multer from "koa-multer";


jest.mock("fs");

function sha3_256(buffer: string | Buffer) {
	return crypto.createHash("sha3-256").update(buffer).digest("hex");
}

const select = jest.fn();
const save = jest.fn();

beforeEach(() => {
	select.mockReturnValue(null);
	save.mockReturnValue(Promise.resolve());
});

// 创建测试应用，图片服务依赖multer解析multipart请求，后面加个418状态码的用于测试非图片请求
const app = new Koa();
const uploader = multer({ limits: { fileSize: 4 * 1024 * 1024 } });
app.use(uploader.single("file"));
app.use(createImageMiddleware({ save, select } as any));
app.use((ctx) => ctx.status = 418);
const server = app.callback();

const FILE_NAME = "/test.gif";
const IMAGE_DATA = Buffer.from("R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==", "base64");

it("should response image", async () => {
	select.mockReturnValue(FILE_NAME);
	fs.writeFileSync(FILE_NAME, IMAGE_DATA);

	await supertest(server)
		.get("/image" + FILE_NAME)
		.expect(200)
		.expect(Buffer.from(IMAGE_DATA));
});

it("should save a new file", async () => {
	await supertest(server)
		.post("/image")
		.attach("file", IMAGE_DATA, { filename: FILE_NAME, contentType: "image/gif" })
		.expect(200)
		.expect("Location", "/image/" + sha3_256(IMAGE_DATA) + ".gif");

	expect(save.mock.calls.length).toBe(1);
});

it("should fail with invalid method", async () => {
	await supertest(server)
		.patch("/image")
		.expect(405);
	expect(save.mock.calls.length).toBe(0);
});

it("should fail on non exists file", async () => {
	await supertest(server).get("/image/notfound.jpg").expect(404);
	expect(select.mock.calls.length).toBe(1);
});

it("should fail without filename", async () => {
	await supertest(server).get("/image").expect(404);
	await supertest(server).get("/image/").expect(404);
	expect(select.mock.calls.length).toBe(0);
});

it("should delegate not concerned to next", () => {
	return supertest(server).get("/another").expect(418);
});
