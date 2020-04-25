import http from "http";
import tls from "tls";
import { createSNICallback, runServer } from "../lib/create-server";
import { ServerOptions } from "../lib/options";
import { resolveFixture } from "./test-utils";

const HTTP_URL = "http://localhost:12500/";
const HTTPS_URL = "https://localhost:12501/";

const OPTIONS: ServerOptions = {
	http: {
		port: 12500,
		redirect: true,
	},
	https: {
		port: 12501,
		certFile: resolveFixture("localhost.pem"),
		keyFile: resolveFixture("localhost.pvk"),
	},
};

describe("app.runServer", () => {
	let close: () => void;

	beforeAll(async () => {
		close = await runServer((req, res: any) => res.end("hello"), OPTIONS);
	});

	afterAll(() => close());

	it("should redirect to https", async (done) => {
		http.get(HTTP_URL, ((res) => {
			expect(res.statusCode).toEqual(301);
			expect(res.headers.location).toEqual(HTTPS_URL);
			done();
		})).end();
	});
});

describe("SNI callback", () => {
	let server: tls.Server;

	// 创建一个TLS服务器，没有默认证书而是使用SNI回调
	beforeAll((done) => {
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
		server.listen(41000, done);
	});

	// 记得关闭服务器，不然测试进程无法退出
	afterAll((done) => server.close(done));

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
		return new Promise((resolve, reject) => {
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

	it("should throw error with invalid servername", async () => {
		expect.assertions(1);
		try {
			await verifyCertCN("invaildhost");
		} catch (e) {
			expect(e.message).toBe("Client network socket disconnected before secure TLS connection was established");
		}
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
