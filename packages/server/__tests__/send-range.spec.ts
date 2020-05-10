import Koa from "koa";
import supertest from "supertest";
import sendFileRange from "../lib/send-range";
import { FIXTURE_DIR } from "./test-utils";

const app = new Koa();
app.use(ctx => {
	ctx.type = "text/plain";
	sendFileRange(ctx, FIXTURE_DIR + "/sendrange.txt", 475);
});

// 【坑】如果被测代码的 Content-Length 计算错误的话会抛出奇怪的错误：
// Parse Error: Expected HTTP/

it('should send file without Range', () => {
	return supertest(app.callback())
		.get('/')
		.expect('Content-Length', "5")
		.expect(200, "world");
});

it('should send file part', () => {
	return supertest(app.callback())
		.get('/')
		.set("Range", "bytes=1-3")
		.expect('Accept-Ranges', 'bytes')
		.expect('Content-Range', "bytes 1-3/5")
		.expect('Content-Length', "3")
		.expect(206, "orl");
});

it('should send file part with range N-', () => {
	return supertest(app.callback())
		.get('/')
		.set("Range", "bytes=1-")
		.expect('Accept-Ranges', 'bytes')
		.expect('Content-Range', "bytes 1-4/5")
		.expect('Content-Length', "4")
		.expect(206, "orld");
});

it('should send file part with range -N', () => {
	return supertest(app.callback())
		.get('/')
		.set("Range", "bytes=-2")
		.expect('Accept-Ranges', 'bytes')
		.expect('Content-Range', "bytes 3-4/5")
		.expect('Content-Length', "2")
		.expect(206, "ld");
});

function getChunks(res: supertest.Response) {
	const boundary = res.get("Content-Type").substring("multipart/byteranges; boundary=".length);
	return res.body.toString().split("--"+boundary)
		.map((part: string) => part.replace(/^-+/, '').trim())
		.map((part: string) => part.split('\r\n\r\n')[1])
		.filter(Boolean);
}

it('should sends multi-chunk response on multi-range (specific ranges)', async () => {
	const res = await supertest(app.callback())
		.get('/')
		.parse((x: supertest.Response, cb) => {
			let data = "";
			x.on("data", d => data += d);
			x.on("end", () => cb(null, data));
		})
		.set("Range", "bytes=80-83,429-472,294-304")
		.expect('Content-Type', /^multipart\/byteranges; boundary=/)
		.expect('Content-Length', "363")

	const chunks = getChunks(res);
	expect(chunks).toHaveLength(3);
	expect(chunks[0]).toEqual('MUST');
	expect(chunks[1]).toEqual('this field will be sent in each part instead');
	expect(chunks[2]).toEqual('single-part');
});

// https://github.com/koajs/koa-range/issues/15
it('should return 206 with range larger than total length', () => {
	return supertest(app.callback())
		.get('/')
		.set('Range', 'bytes=0-100')
		.expect('Content-Range', 'bytes 0-4/5')
		.expect('Content-Length', '5')
		.expect(206, "world");
});

it('should return 416 with range out of bound', () => {
	return supertest(app.callback())
		.get('/')
		.set("Range", "bytes=800-900")
		.expect('Content-Range', "bytes */5")
		.expect(416);
});

it('should return 400 with invalid Range header', () => {
	return supertest(app.callback()).get('/').set("Range", "invalid").expect(400);
});
