import Axios from "axios";
import http2, { Http2ServerRequest, Http2ServerResponse } from "http2";
import { AddressInfo, Server } from "net";
import { adaptAxiosHttp2 } from "../axios-http2";
import fs from "fs-extra";
import path from "path";


function hellowHandler(req: Http2ServerRequest, res: Http2ServerResponse) {
	res.writeHead(200, { "Content-Type": "text/plain" }).end("Hellow");
}

describe("h2c", () => {

	let server: Server;
	let url: string;

	// 创建一个仅支持HTTP2的服务器来测试
	beforeAll((done) => {
		server = http2.createServer(hellowHandler);
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
		adaptAxiosHttp2(axios);

		const response = await axios.get(url);
		expect(response.data).toBe("Hellow");
	});
});

describe("certificate verification", () => {

	function loadResource(name: string) {
		return fs.readFileSync(path.join(__dirname, "resources", name));
	}

	let server: Server;
	let url: string;

	beforeAll((done) => {
		server = http2.createSecureServer({
			cert: loadResource("localhost.pem"),
			key: loadResource("localhost.pvk"),
		});
		server.listen(0, () => {
			done();
			url = "http://localhost:" + (server.address() as AddressInfo).port;
		});
		server.on("request", hellowHandler);
	});

	afterAll((done) => server.close(done));

	// it("should reject self signed certificate", () => {
	// 	const axios = Axios.create();
	// 	adaptAxiosHttp2(axios, true);
	//
	// 	return expect(axios.get(url)).rejects.toBeTruthy();
	// });

	it("should success with trust", async () => {
		const axios = Axios.create();
		adaptAxiosHttp2(axios, true, { ca: loadResource("localhost.pem") });

		const res = await axios.get(url);
		expect(res.data).toBe("Hellow");
	});
});
