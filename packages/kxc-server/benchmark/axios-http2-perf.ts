import http2 from "http2";
import Axios from "axios";
import { adaptAxiosHttp2 } from "../axios-http2";
import { AddressInfo } from "net";

// 450 ms 1368 ms
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
