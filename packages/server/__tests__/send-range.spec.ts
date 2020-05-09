import Koa from "koa";
import supertest from "supertest";
import sendFileRange from "../lib/send-range";
import { FIXTURE_DIR } from "./test-utils";

const app = new Koa();
app.use(ctx => {
	ctx.type = "text/plain";
	sendFileRange(ctx, FIXTURE_DIR + "/hello.txt", 5);
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

// https://github.com/koajs/koa-range/issues/15
it('should return 206 with range larger than total length', () => {
	return supertest(app.listen())
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
