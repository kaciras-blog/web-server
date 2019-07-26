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
const save = jest.fn(() => Promise.resolve());

const middleware = createImageMiddleware({ save, select } as any);

const app = new Koa();
const uploader = multer({ limits: { fileSize: 4 * 1024 * 1024 } });
app.use(uploader.single("file"));
app.use(middleware);
const server = app.callback();

it("should ", async () => {
	select.mockReturnValue("/abcd.jpg");
	fs.writeFileSync("/abcd.jpg", "test data");

	await supertest(server)
		.get("/image/abcd.jpg")
		.expect(200)
		.expect(Buffer.from("test data"));
});

it("POST for save new file", async () => {
	const buffer = Buffer.from("TEST CONTENT");

	await supertest(server)
		.post("/image")
		.attach("file", buffer, { filename: "asd.png", contentType: "image/png" })
		.expect(200)
		.expect("Location", "/image/" + sha3_256(buffer) + ".png");

	expect(save.mock.calls.length).toBe(1);
});

it("Invaild method", async () => {
	await supertest(server)
		.patch("/image")
		.expect(405);
	expect(save.mock.calls.length).toBe(0);
});
