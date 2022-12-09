import tls from "tls";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import supertest from "supertest";
import startServer, { createSNICallback, ServerGroup } from "../lib/create-server.js";
import { ServerOptions } from "../lib/config.js";
import { resolveFixture } from "./test-utils.js";

const HTTPS_URL = "https://localhost:12501";

describe("app.startServer", () => {
	const OPTIONS: ServerOptions = {
		connectors: [
			{
				version: 1,
				port: 12500,
				redirect: HTTPS_URL,
			},
			{
				version: 1,
				port: 12501,
				certFile: resolveFixture("localhost.pem"),
				keyFile: resolveFixture("localhost.pvk"),
			},
			{
				version: 2,
				port: 12502,
			},
			{
				version: 2,
				port: 12503,
				certFile: resolveFixture("localhost.pem"),
				keyFile: resolveFixture("localhost.pvk"),
			},
		],
	};

	let serverGroup: ServerGroup;

	beforeAll(async () => {
		serverGroup = await startServer((req, res: any) => res.end("hello"), OPTIONS);
	});

	afterAll(() => serverGroup.forceClose());

	it("should redirect to https", async () => {
		await supertest(serverGroup.servers[0])
			.get("/")
			.expect(301)
			.expect("location", HTTPS_URL + "/");
	});
});

describe("SNI callback", () => {
	let server: tls.Server;

	// 创建一个TLS服务器，没有默认证书而是使用SNI回调
	beforeAll(() => new Promise(resolve => {
		const sniCallback = createSNICallback([{
			hostname: "localhost",
			cert: resolveFixture("localhost.pem"),
			key: resolveFixture("localhost.pvk"),
		}, {
			hostname: "anotherhost",
			cert: resolveFixture("anotherhost.pem"),
			key: resolveFixture("anotherhost.pvk"),
		}]);

		server = tls.createServer({
			SNICallback: sniCallback,
		}, (socket) => {
			socket.write("HELLO");
			socket.end();
		});
		server.listen(41000, resolve);
	}));

	// 记得关闭服务器，不然测试进程无法退出
	afterAll(() => new Promise<any>(resolve => server.close(resolve)));

	/**
	 * 连接服务器并验证证书和响应是否正确。
	 *
	 * @param servername 服务器名
	 */
	function verifyCertCN(servername: string) {
		const socket = tls.connect({
			servername,
			host: "localhost",
			port: 41000,
			rejectUnauthorized: false,
		});
		return new Promise<void>((resolve, reject) => {
			socket.on("secureConnect", () => {
				const cert = socket.getPeerCertificate();
				expect(cert.subject.CN).toEqual(servername);
			});
			socket.on("data", (data) => {
				resolve();
				socket.end();
				expect(data.toString()).toBe("HELLO");
			});
			socket.on("error", reject);
		}).finally(() => {
			socket.destroy();
		});
	}

	it("should throw error with invalid servername", () => {
		return expect(verifyCertCN("invaild")).rejects
			.toThrow("Client network socket disconnected before secure TLS connection was established");
	});

	it("should accept localhost", () => {
		expect.assertions(2);
		return verifyCertCN("localhost");
	});

	it("should accept multiple times", async () => {
		expect.assertions(6);
		await verifyCertCN("anotherhost");
		await verifyCertCN("anotherhost");
		await verifyCertCN("anotherhost");
	});
});
