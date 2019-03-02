import http from "http";
import path from "path";
import tls from "tls";
import { createSNICallback, runServer } from "../app";


const HTTP_URL = "http://localhost/";
const HTTPS_URL = "https://localhost/";

const OPTIONS = {
	tls: true,
	certificate: "D:/Coding/Utils/dev.pem",
	privatekey: "D:/Coding/Utils/dev.pvk",
	redirectHttp: true,
};

describe("app.runServer", () => {
	let close: () => void;

	beforeAll(async () => {
		close = await runServer((req, res: any) => res.end("hellow"), OPTIONS);
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

	function resloveResource (name: string) {
		return path.join(__dirname, "resources", name);
	}

	// 创建一个TLS服务器，没有默认证书而是使用SNI回调
	beforeAll((done) => {
		const sniCallback = createSNICallback([{
			hostname: "localhost",
			cert: resloveResource("localhost.crt"),
			key: resloveResource("localhost.pvk"),
		}, {
			hostname: "127.0.0.2",
			cert: resloveResource("127_0_0_2.crt"),
			key: resloveResource("127_0_0_2.pvk"),
		}]);

		server = tls.createServer({
			SNICallback: sniCallback,
		}, (socket) => {
			socket.write("HELLOW");
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
	function verifyCertCN (servername: string) {
		return new Promise((resolve, reject) => {
			const socket = tls.connect({
				host: servername,
				port: 41000,
				rejectUnauthorized: false,
				servername,
			});
			socket.on("secureConnect", () => {
				const cert = socket.getPeerCertificate();
				expect(cert.subject.CN).toEqual(servername);
			});
			socket.on("data", (data) => {
				expect(data.length).toBe(6);
				resolve();
				socket.end();
			});
			socket.on("error", reject);
		});
	}

	it("should throw error with invalid servername", async () => {
		expect.assertions(1);
		try {
			await verifyCertCN("127.0.0.1");
		} catch (e) {
			expect(e.message).toBe("Client network socket disconnected before secure TLS connection was established");
		}
	});

	it("should accept localhost", () => {
		return verifyCertCN("localhost");
	});

	it("should accept mutiple times", async () => {
		await verifyCertCN("127.0.0.2");
		await verifyCertCN("127.0.0.2");
		await verifyCertCN("127.0.0.2");
	});
});
