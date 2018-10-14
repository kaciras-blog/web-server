const http2 = require("http2");
const axios = require("axios");

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

/**
 * 简单的适配HTTP2到https.request()，因为傻B的Tomcat不支持Http2降级Http1.1。
 * 注意这段代码是半小时写的，没有测试有没有内存泄漏。
 */
function request (options, callback) {
	let host = `https://${options.hostname}`;
	if (options.port) {
		host += ":" + options.port;
	}

	const client = http2.connect(host);
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


axios.defaults.transport = { request };

axios.get("https://localhost:2375/articles?start=0&category=0&count=16&deletion=FALSE")
	.then(res => console.log(1));
axios.get("https://localhost:2375/articles?start=0&category=0&count=16&deletion=FALSE")
	.then(res => console.log(2));
