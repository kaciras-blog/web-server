const http2 = require("http2");
const Axios = require("axios");
const fs = require("fs");


/**
 * 简单的适配HTTP2到https.request()，因为傻B的Tomcat不支持Http2降级Http1.1。
 * 注意这段代码是半小时写的，没有测试有没有内存泄漏。
 */
function request (options, callback) {
	let host = `https://${options.hostname}`;
	if (options.port) {
		host += ":" + options.port;
	}

	const client = http2.connect(host, {
		ca: fs.readFileSync("D:/Coding/Utils/dev.pem"), // Trust self signed certificate
	});
	const req = client.request({
		...options.headers,
		":method": options.method.toUpperCase(),
		":path": options.path,
	});

	req.on("response", headers => {
		req.headers = headers;
		req.statusCode = headers[":status"];
		callback(req);
	});
	req.on("end", () => client.close());
	return req;
}

// 创建一个仅支持HTTP2的服务器来测试
let server = http2.createSecureServer({
	cert: fs.readFileSync("D:/Coding/Utils/dev.pem"),
	key: fs.readFileSync("D:/Coding/Utils/dev.pvk"),
	allowHTTP1: false,
}, (req, res) => {
	res.writeHead(200, { "Content-Type": "text/plain" });
	res.write("Hellow");
	res.end();
});

beforeAll(done => server.listen(0, done));
afterAll(done => server.close(done));


it("fail without adapt", () => {
	expect.assertions(1);
	const axios = Axios.create();

	return axios.get("https://localhost:" + server.address().port)
		.catch(err => expect(err).toBeTruthy());
});

it("success with adapt", async () => {
	const axios = Axios.create({
		transport: { request },
	});
	const res = await axios.get("https://localhost:" + server.address().port);
	expect(res.data).toBe("Hellow");
});
