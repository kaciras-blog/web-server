import Axios from "axios";
import http2, { Http2ServerRequest, Http2ServerResponse } from "http2";
import { AddressInfo } from "net";
import { adaptAxiosHttp2 } from "../axios-http2";
import fs from "fs-extra";
import path from "path";


function hellowHandler(req: Http2ServerRequest, res: Http2ServerResponse) {
	res.writeHead(200, { "Content-Type": "text/plain" }).end("Hellow");
}

describe("h2c", () => {

	// 创建一个仅支持HTTP2的服务器来测试
	const server = http2.createServer(hellowHandler);
	beforeAll((done) => server.listen(0, done));
	afterAll((done) => server.close(done));

	it("should fail without adapt", () => {
		expect.assertions(1);
		const axios = Axios.create();

		return axios.get("http://localhost:" + (server.address() as AddressInfo).port)
			.catch((err: any) => expect(err).toBeTruthy());
	});

	it("should success with adapt", async () => {
		const axios = Axios.create();
		adaptAxiosHttp2(axios);
		const res = await axios.get("http://localhost:" + (server.address() as AddressInfo).port);
		expect(res.data).toBe("Hellow");
	});
});

describe("certificate verification", () => {

	function loadResource(name: string) {
		return fs.readFileSync(path.join(__dirname, "resources", name));
	}

	const server = http2.createSecureServer({
		cert: loadResource("localhost.pem"),
		key: loadResource("localhost.pvk"),
	});
	server.on("request", hellowHandler);

	beforeAll((done) => server.listen(0, done));
	afterAll((done) => server.close(done));

	it("should reject self signed certificate", async () => {
		const axios = Axios.create();
		adaptAxiosHttp2(axios, true);

		expect(axios.get("https://localhost:" + (server.address() as AddressInfo).port))
			.rejects.toBe(1);
	});

	it("should success with trust", async () => {
		const axios = Axios.create();
		adaptAxiosHttp2(axios, true, { ca: loadResource("localhost.pem") });

		const res = await axios.get("https://localhost:" + (server.address() as AddressInfo).port);
		expect(res.data).toBe("Hellow");
	});
});
