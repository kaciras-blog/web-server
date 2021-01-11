import http2, { Http2ServerRequest, Http2ServerResponse } from "http2";
import { AddressInfo, Server } from "net";
import Axios, { AxiosRequestConfig } from "axios";
import Koa from "koa";
import supertest from "supertest";
import { readFixtureText, sleep } from "./test-utils";
import { CachedFetcher, configureAxiosHttp2, configureForProxy, CSRF_HEADER_NAME } from "../lib/axios-helper";

jest.useFakeTimers();

function helloHandler(req: Http2ServerRequest, res: Http2ServerResponse) {
	res.writeHead(200, { "Content-Type": "text/plain" }).end("Hello");
}

// 使用一个仅支持HTTP2的服务器来测试
describe("configureAxiosHttp2", () => {
	let server: Server;
	let url: string;
	let cleanSessions: () => void;

	beforeEach(async () => {
		cleanSessions = () => 0;
		server = http2.createServer(helloHandler);
		await new Promise<void>(resolve => server.listen(0, resolve));
		url = "http://localhost:" + (server.address() as AddressInfo).port;
	});

	afterEach((done) => {
		cleanSessions();
		server.close(done);
	});

	it("should fail without adapt", () => {
		const axios = Axios.create();
		return expect(axios.get(url)).rejects.toBeTruthy();
	});

	it("should success with adapt", async () => {
		const axios = Axios.create();
		cleanSessions = configureAxiosHttp2(axios);

		const response = await axios.get(url);
		expect(response.data).toBe("Hello");
	});

	it("should eliminate session with error", async () => {
		const axios = Axios.create();
		cleanSessions = configureAxiosHttp2(axios);

		await expect(axios.get("http://localhost:1")).rejects.toThrow();

		const response = await axios.get(url);
		expect(response.data).toBe("Hello");
	});

	it("should support cancellation", async () => {
		const axios = Axios.create();
		cleanSessions = configureAxiosHttp2(axios);

		server.removeAllListeners("request");

		server.on("request", async (request, response) => {
			jest.runOnlyPendingTimers();
			await sleep();
			response.on("close", () => jest.runOnlyPendingTimers());
		})

		const tokenSource = Axios.CancelToken.source();
		const res = axios.get(url, { cancelToken: tokenSource.token }).catch(e => e);

		await sleep();
		tokenSource.cancel("Cancel message");
		jest.runOnlyPendingTimers();

		await sleep();
		expect((await res).message).toBe("Cancel message");
	});
});

describe("certificate verification", () => {
	let url: string;
	let server: Server;

	beforeAll((done) => {
		server = http2.createSecureServer({
			cert: readFixtureText("localhost.pem"),
			key: readFixtureText("localhost.pvk"),
		});
		server.listen(0, () => {
			done();
			url = "http://localhost:" + (server.address() as AddressInfo).port;
		});
		server.on("request", helloHandler);
	});

	afterAll((done) => server.close(done));

	it("should success with trust", async () => {
		const axios = Axios.create();
		const cleanSessions = configureAxiosHttp2(axios, true, {
			ca: readFixtureText("localhost.pem"),
		});
		const res = await axios.get(url).finally(cleanSessions);
		expect(res.data).toBe("Hello");
	});
});

describe("configureForProxy", () => {

	function createApp() {
		const config: AxiosRequestConfig = {};
		const app = new Koa();
		app.use((ctx) => configureForProxy(ctx, config));
		return [app, config] as [Koa, AxiosRequestConfig];
	}

	it("should set forwarded headers", async () => {
		const [app, config] = createApp();
		await supertest(app.callback()).get("/");

		// 检查不要添加多余的头部
		expect(Object.keys(config.headers)).toHaveLength(1);

		expect(config.headers["X-Forwarded-For"]).toBe("::ffff:127.0.0.1");
	});

	it("should add principal info", async () => {
		const [app, config] = createApp();

		await supertest(app.callback())
			.get("/")
			.set("Cookie", ["CSRF-Token=hello"]);

		expect(Object.keys(config.headers)).toHaveLength(3);
		expect(config.headers[CSRF_HEADER_NAME]).toBe("hello");
		expect(config.headers.Cookie).toBe("CSRF-Token=hello");
	});

	it("should accept X-Forwarded-For", async () => {
		const [app, config] = createApp();
		app.proxy = true;

		await supertest(app.callback())
			.get("/")
			.set("X-Forwarded-For", "222.111.0.0");

		expect(config.headers["X-Forwarded-For"]).toBe("222.111.0.0");
	});
});

describe("CachedFetcher", () => {
	const mockRequest = jest.fn();

	const axios = Axios.create();
	axios.request = mockRequest;

	const instance = new CachedFetcher(axios, (res) => res.data);

	function mockResponse(status: number, data?: any, multiple = false) {
		const response = Promise.resolve({ status, data, headers: {} });
		if (multiple) {
			mockRequest.mockResolvedValue(response);
		} else {
			mockRequest.mockResolvedValueOnce(response);
		}
	}

	/** 设置缓存，请勿使用 undefined 作为 data 参数 */
	function putCache(fetcher: CachedFetcher<any, any>, data: any, config: AxiosRequestConfig = {}) {
		mockResponse(200, data);
		return fetcher.request(config);
	}

	/** 获取缓存的值，如果没有缓存则返回 undefined */
	function getCache(fetcher: CachedFetcher<any, any>, config: AxiosRequestConfig = {}) {
		mockResponse(304);
		return fetcher.request(config);
	}

	it("should cache result", async () => {
		mockResponse(200, 100);
		mockResponse(304, 456);
		expect(await instance.request({})).toBe(100);
		expect(await instance.request({})).toBe(100);
	});

	it("should isolate difference requests", async () => {
		await putCache(instance, 100, { url: "A" });
		await putCache(instance, 200, { url: "B" });

		mockResponse(304, null, true);
		expect(await instance.request({ url: "A" })).toBe(100);
		expect(await instance.request({ url: "B" })).toBe(200);
	});

	// If-Modified-Since 只精确到秒，需要清除起始时间的毫秒部分
	it("should set header", async () => {
		const start = new Date();
		start.setMilliseconds(0);
		await putCache(instance, 100);

		mockRequest.mockImplementation((config) => {
			const value = config.headers["If-Modified-Since"];
			const mtime = new Date(value).getTime();
			expect(mtime).toBeGreaterThanOrEqual(start.getTime());
			return { status: 200, headers: {} };
		});

		await instance.request({});
	});

	it("should delete expired cache", async () => {
		const timeoutFetcher = new CachedFetcher(axios, (res) => res.data, 10 * 1000);
		await putCache(timeoutFetcher, 100);

		jest.runOnlyPendingTimers();
		expect(await getCache(timeoutFetcher)).toBeUndefined();
	});
});
