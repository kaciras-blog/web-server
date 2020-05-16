import supertest from "supertest";
import Koa from "koa";
import { FIXTURE_DIR } from "./test-utils";
import serve from '../lib/koa/static-files';

it("should serve from cwd when root = '.'", () => {
	const app = new Koa();
	app.use(serve('.'));

	return supertest(app.callback()).get('/package.json').expect(200);
});

it('should pass to next for directory', () => {
	const app = new Koa();
	app.use(serve(FIXTURE_DIR));
	app.use(ctx => ctx.body = "hello");

	return supertest(app.callback())
		.get('/static')
		.expect(200, "hello");
});

describe("when path is not a file", () => {
	it('should 404', () => {
		const app = new Koa();
		app.use(serve(FIXTURE_DIR));

		return supertest(app.callback()).get('/something').expect(404);
	});

	it("should not throw 404 error", async () => {
		let err: any = null;

		const app = new Koa();
		app.use((ctx, next) => next().catch(e => err = e));
		app.use(serve(FIXTURE_DIR));
		app.use((ctx) => ctx.body = 'ok');

		const res = await supertest(app.callback()).get('/something').expect(200);

		expect(err).toBeNull();
		expect(res.text).toBe("ok");
	});
});

it('should prevent access for path outside root', () => {
	const app = new Koa();
	app.use(serve(FIXTURE_DIR));

	return supertest(app.callback()).get('/../../package.json').expect(403);
});

it('should pass to next when method is not `GET` or `HEAD`', () => {
	const app = new Koa();
	app.use(serve(FIXTURE_DIR));

	return supertest(app.callback()).post('/hello.txt').expect(404);
});

it('should 400 when path is malformed', () => {
	const app = new Koa();
	app.use(serve(FIXTURE_DIR));

	return supertest(app.callback()).get('/%').expect(400);
});

it('should serve the file', () => {
	const app = new Koa();
	app.use(serve(FIXTURE_DIR));
	app.use((ctx, next) => {
		return next().then(() => ctx.body = "hey");
	});

	return supertest(app.callback())
		.get('/hello.txt')
		.set('Accept-Encoding', 'deflate, identity')
		.expect(200)
		.expect('Content-Length', '5')
		.expect('world');
});

it('should set the Content-Type', () => {
	const app = new Koa()
	app.use(serve(FIXTURE_DIR));

	return supertest(app.callback())
		.get('/static/hello.json')
		.expect('Content-Type', /application\/json/);
});

it('should support Range header', () => {
	const app = new Koa()
	app.use(serve(FIXTURE_DIR));

	return supertest(app.callback())
		.get('/hello.txt')
		.set("Range", "bytes=1-3")
		.set('Accept-Encoding', 'deflate, identity')
		.expect('Accept-Ranges', 'bytes')
		.expect('Content-Range', "bytes 1-3/5")
		.expect('Content-Length', "3")
		.expect(206, "orl");
});

it('should return .gz version when requested and if possible', () => {
	const app = new Koa()
	app.use(serve(FIXTURE_DIR));

	return supertest(app.callback())
		.get('/hello.txt')
		.set('Accept-Encoding', 'gzip, deflate')
		.expect(200)
		.expect('Content-Type', /text\/plain/)
		.expect('Content-Length', '25')
		.expect('Content-Encoding', 'gzip');
});

it('should return .br version when requested and if possible', () => {
	const app = new Koa()
	app.use(serve(FIXTURE_DIR));

	return supertest(app.callback())
		.get('/hello.txt')
		.set('Accept-Encoding', 'gzip, deflate, br')
		.expect(200)
		.expect('Content-Type', /text\/plain/)
		.expect('Content-Length', '9')
		.expect('Content-Encoding', 'br');
});

describe('Cache-Control', () => {
	it('should be set for static files', () => {
		const app = new Koa()
		app.use(serve(FIXTURE_DIR, { staticAssets: /^\/static/, maxAge: 666 }));

		return supertest(app.callback())
			.get('/static/hello.json')
			.expect(200)
			.expect('Cache-Control', 'public,max-age=666,immutable');
	});

	it('should be set with maxAge=31536000 by default', () => {
		const app = new Koa()
		app.use(serve(FIXTURE_DIR, { staticAssets: /^\/static/ }));

		return supertest(app.callback())
			.get('/static/hello.json')
			.expect(200)
			.expect('Cache-Control', 'public,max-age=31536000,immutable');
	});

	it('should not be set for non-static files', async () => {
		const app = new Koa()
		app.use(serve(FIXTURE_DIR, { staticAssets: /^\/static/ }));

		const res = await supertest(app.callback()).get('/hello.txt').expect(200);
		expect("cache-control" in res.header).toBe(false);
	});
});
