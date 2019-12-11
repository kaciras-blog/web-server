import http2, { Http2ServerRequest, Http2ServerResponse } from "http2";
import { AddressInfo, Server } from "net";
import Axios, { AxiosRequestConfig } from "axios";
import Koa from "koa";
import supertest from "supertest";
import { readFixtureText } from "./test-utils";
import {
	configureAxiosHttp2,
	CachedFetcher,
	configureForProxy,
	CSRF_HEADER_NAME,
	CSRF_PARAMETER_NAME,
} from "../lib/axios-helper";

jest.useFakeTimers();

function helloHandler(req: Http2ServerRequest, res: Http2ServerResponse) {
	res.writeHead(200, { "Content-Type": "text/plain" }).end("Hello");
}

describe("h2c", () => {
	let url: string;
	let server: Server;

	// 创建一个仅支持HTTP2的服务器来测试
	beforeAll((done) => {
		server = http2.createServer(helloHandler);
		server.listen(0, () => {
			done();
			url = "http://localhost:" + (server.address() as AddressInfo).port;
		});
	});
	afterAll((done) => server.close(done));

	it("should fail without adapt", () => {
		const axios = Axios.create();
		return expect(axios.get(url)).rejects.toBeTruthy();
	});

	it("should success with adapt", async () => {
		const axios = Axios.create();
		configureAxiosHttp2(axios);

		const response = await axios.get(url);
		expect(response.data).toBe("Hello");
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

	// TODO: 自签证书的错误如何捕获？
	// it("should reject self signed certificate", () => {
	// 	const axios = Axios.create();
	// 	configureAxiosHttp2(axios, true);
	//
	// 	return expect(axios.get(url)).rejects.toBeTruthy();
	// });

	it("should success with trust", async () => {
		const axios = Axios.create();
		configureAxiosHttp2(axios, true, { ca: readFixtureText("localhost.pem") });

		const res = await axios.get(url);
		expect(res.data).toBe("Hello");
	});
});

describe("configureForProxy", () => {
	let config: AxiosRequestConfig = {};
	const app = new Koa();
	const server = app.callback();

	app.use((ctx) => {
		config = {};
		configureForProxy(ctx, config);
	});

	it("should set forwarded headers", async () => {
		await supertest(server).get("/");

		// 检查不要添加多余的头部
		expect(Object.keys(config.headers)).toHaveLength(2);

		expect(config.headers["X-Forwarded-For"]).toBe("::ffff:127.0.0.1");
		expect(config.headers["User-Agent"]).toMatch("superagent");
	});

	it("should add principal info", async () => {
		await supertest(server).get("/")
			.query({ [CSRF_PARAMETER_NAME]: "csrf_parameter" })
			.set("Cookie", ["test_cookie"])
			.set(CSRF_HEADER_NAME, "csrf_header");

		expect(config.headers[CSRF_HEADER_NAME]).toBe("csrf_header");
		expect(config.headers.Cookie).toBe("test_cookie");
		expect(config.params[CSRF_PARAMETER_NAME]).toBe("csrf_parameter");
	});
});

describe("CachedFetcher", () => {
	const mockRequest = jest.fn();

	const axios = Axios.create();
	axios.request = mockRequest;

	const instance = new CachedFetcher(axios, (res) => res.data);

	function mockResponse(status: number, data?: any, multiple: boolean = false) {
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
