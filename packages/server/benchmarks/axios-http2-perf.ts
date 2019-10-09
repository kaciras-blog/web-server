import http2 from "http2";
import Axios from "axios";
import { adaptAxiosHttp2 } from "../lib/axios-helper";
import { AddressInfo } from "net";

/*
 * 测试 axios-http2 的性能：
 * 不缓存 ClientHttp2Session - 1368 毫秒 / 1000次请求
 * 缓存 ClientHttp2Session - 450 毫秒 / 1000次请求
 */
const axios = Axios.create();
adaptAxiosHttp2(axios);
const server = http2.createServer(((request, response) => response.end("benchmark")));

async function iterate() {
	const url = "http://localhost:" + (server.address() as AddressInfo).port;
	const from = process.hrtime();
	for (let i = 0; i < 1000; i++) {
		await axios.get(url);
		// const res = await axios.get(url);
		// assert res.status === 200
		// assert res.data === "benchmark"
	}
	const to = process.hrtime();
	return (to[0] - from[0]) * 1000 + (to[1] - from[1]) / 1000000;
}

/** 除了测试性能之外，还测试了ClientHttp2Session的超时时间 */
async function run() {
	let timeUsage = 0;
	for (let i = 0; i < 5; i++) {
		timeUsage += await iterate();
	}
	console.log(`平均用时：${timeUsage / 5}ms`);

	const perfEnd = process.hrtime()[0];
	server.close(() => {
		const idle = process.hrtime()[0] - perfEnd;
		console.log(`ClientHttp2Session 在${idle}秒后自动关闭`);
	});
}

server.listen(0, run);
