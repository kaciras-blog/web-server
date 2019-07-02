import http from "http";
import path from "path";
import tls from "tls";
import { createSNICallback, runServer, ServerOptions } from "../infra/create-server";


const HTTP_URL = "http://localhost/";
const HTTPS_URL = "https://localhost/";

const OPTIONS: ServerOptions = {
	https: {
		certFile: "D:/Coding/Utils/dev.pem",
		keyFile: "D:/Coding/Utils/dev.pvk",
	},
	http: { redirect: true },
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

	function resloveResource(name: string) {
		return path.join(__dirname, "resources", name);
	}

	// 创建一个TLS服务器，没有默认证书而是使用SNI回调
	beforeAll((done) => {
		const sniCallback = createSNICallback([{
			hostname: "localhost",
			cert: resloveResource("localhost.pem"),
			key: resloveResource("localhost.pvk"),
		}, {
			hostname: "anotherhost",
			cert: resloveResource("anotherhost.pem"),
			key: resloveResource("anotherhost.pvk"),
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
	function verifyCertCN(servername: string) {
		return new Promise((resolve, reject) => {
			const socket = tls.connect({
				servername,
				host: "localhost",
				port: 41000,
				rejectUnauthorized: false,
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
			await verifyCertCN("invaildhost");
		} catch (e) {
			expect(e.message).toBe("Client network socket disconnected before secure TLS connection was established");
		}
	});

	it("should accept localhost", () => {
		return verifyCertCN("localhost");
	});

	it("should accept mutiple times", async () => {
		await verifyCertCN("anotherhost");
		await verifyCertCN("anotherhost");
		await verifyCertCN("anotherhost");
	});
});
