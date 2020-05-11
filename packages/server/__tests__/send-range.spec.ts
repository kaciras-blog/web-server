import fs from "fs-extra";
import Koa from "koa";
import supertest from "supertest";
import sendFileRange from "../lib/send-range";
import { FIXTURE_DIR } from "./test-utils";

const FILE = FIXTURE_DIR + "/sendrange.txt";

const app = new Koa();
app.use(ctx => {
	ctx.type = "text/plain";
	sendFileRange(ctx, FILE, 475);
});

// 【坑】如果被测代码的 Content-Length 计算错误的话会抛出奇怪的错误：
// Parse Error: Expected HTTP/

it('should send file without Range', () => {
	return supertest(app.callback())
		.get('/')
		.expect('Content-Length', "475")
		.expect(200, fs.readFileSync(FILE, { encoding: "utf8" }));
});

it('should send file part', () => {
	return supertest(app.callback())
		.get('/')
		.set("Range", "bytes=1-3")
		.expect('Accept-Ranges', 'bytes')
		.expect('Content-Range', "bytes 1-3/475")
		.expect('Content-Length', "3")
		.expect(206, "f m");
});

it('should send file part with range N-', () => {
	return supertest(app.callback())
		.get('/')
		.set("Range", "bytes=470-")
		.expect('Accept-Ranges', 'bytes')
		.expect('Content-Range', "bytes 470-474/475")
		.expect('Content-Length', "5")
		.expect(206, "ead).");
});

it('should send file part with range -N', () => {
	return supertest(app.callback())
		.get('/')
		.set("Range", "bytes=-2")
		.expect('Accept-Ranges', 'bytes')
		.expect('Content-Range', "bytes 473-474/475")
		.expect('Content-Length', "2")
		.expect(206, ").");
});

function parseChunks(res: supertest.Response, callback: (err: Error | null, body: any) => void) {
	let data = "";
	res.on("data", d => data += d);
	res.on("end", () => {
		// @ts-ignore DefinedTypes 跟不上版本
		const boundary = res.headers["content-type"]
			.substring("multipart/byteranges; boundary=".length);

		const chunks = data.toString().split("--" + boundary)
			.map((part: string) => part.replace(/^-+/, '').trim())
			.map((part: string) => part.split('\r\n\r\n')[1])
			.filter(Boolean);

		callback(null, chunks);
	});
}

it('should sends multi-chunk response on multi-range (specific ranges)', async () => {
	const res = await supertest(app.callback())
		.get('/')
		.parse(parseChunks)
		.set("Range", "bytes=80-83,429-472,294-304")
		.expect('Content-Type', /^multipart\/byteranges; boundary=/)
		.expect('Content-Length', "363")
		.expect(206);

	const chunks = res.body;
	expect(chunks).toHaveLength(3);
	expect(chunks[0]).toEqual('MUST');
	expect(chunks[1]).toEqual('this field will be sent in each part instead');
	expect(chunks[2]).toEqual('single-part');
});

// https://github.com/koajs/koa-range/issues/15
it('should return 206 with range larger than total length', () => {
	return supertest(app.callback())
		.get('/')
		.set('Range', 'bytes=470-999')
		.expect('Content-Range', 'bytes 470-474/475')
		.expect('Content-Length', '5')
		.expect(206, "ead).");
});

it('should return 416 with range out of bound', () => {
	return supertest(app.callback())
		.get('/')
		.set("Range", "bytes=800-900")
		.expect('Content-Range', "bytes */475")
		.expect(416);
});

it('should return 400 with invalid Range header', () => {
	return supertest(app.callback()).get('/').set("Range", "invalid").expect(400);
});
