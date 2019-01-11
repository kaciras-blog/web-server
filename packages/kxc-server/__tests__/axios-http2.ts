import Axios from "axios";
import http2, { Http2ServerRequest, Http2ServerResponse } from "http2";
import { AddressInfo } from "net";
import { adaptAxiosHttp2 } from "../index";


// 创建一个仅支持HTTP2的服务器来测试
const server = http2.createServer({
	allowHTTP1: false,
}, (req: Http2ServerRequest, res: Http2ServerResponse) => {
	res.writeHead(200, { "Content-Type": "text/plain" });
	res.write("Hellow");
	res.end();
});

beforeAll((done) => server.listen(0, done));
afterAll((done) => server.close(done));


it("fail without adapt", () => {
	expect.assertions(1);
	const axios = Axios.create();

	return axios.get("http://localhost:" + (server.address() as AddressInfo).port)
		.catch((err: any) => expect(err).toBeTruthy());
});

it("success with adapt", async () => {
	const axios = Axios.create();
	adaptAxiosHttp2(axios);
	const res = await axios.get("http://localhost:" + (server.address() as AddressInfo).port);
	expect(res.data).toBe("Hellow");
});
