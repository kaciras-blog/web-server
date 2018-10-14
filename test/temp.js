const http2 = require("http2");
const axios = require("axios");
const logger = require("log4js").getLogger("system");

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

/**
 * 简单的适配HTTP2到https.request()，因为傻B的Tomcat不支持Http2降级Http1.1。
 * 注意这段代码是半小时写的，没有测试有没有内存泄漏，也不支持撤销、重定向。
 *
 * @param host 请求的主机，需要在发送请求之前连接
 * @constructor
 */
function Http2Transport (host) {
	const client = http2.connect(host);

	this.request = function (options, callback) {
		const req = client.request({
			...options.headers,
			":method": options.method.toUpperCase(),
			":path": options.path,
		});

		req.aborted = false;
		req.abort = () => logger.error("Http2适配暂不支持中断");

		req.on("response", headers => {
			req.headers = headers;
			req.statusCode = headers[":status"];
			callback(req);
		});
		return req;
	};
}

axios.defaults.transport = new Http2Transport("https://localhost:2375");

axios.get("https://localhost:2375/articles?start=0&category=0&count=16&deletion=FALSE")
	.then(res => console.log(res.data));
axios.get("https://localhost:2375/articles?start=0&category=0&count=16&deletion=FALSE")
	.then(res => console.log(res.data));
