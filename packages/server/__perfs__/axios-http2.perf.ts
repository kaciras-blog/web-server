import { performance } from "perf_hooks";
import assert from "assert";
import { AddressInfo } from "net";
import http2 from "http2";
import Axios from "axios";
import { configureAxiosHttp2 } from "../lib/axios-helper.js";

/*
 * 测试 axios-http2 的性能（1000次请求）：
 * 缓存 ClientHttp2Session - 481 毫秒
 * 不缓存 ClientHttp2Session - 1368 毫秒
 */
const axios = Axios.create();
const closeClients = configureAxiosHttp2(axios);

const server = http2.createServer((request, response) => response.end("benchmark"));

async function run() {
	const url = "http://localhost:" + (server.address() as AddressInfo).port;

	// 先检查一下下服务器是否能正确响应
	const res = await axios.get(url);
	assert.strictEqual(res.status, 200);
	assert.strictEqual(res.data, "benchmark");

	async function iterate() {
		const from = performance.now();
		for (let i = 0; i < 1000; i++) {
			await axios.get(url);
		}
		return performance.now() - from;
	}

	let results = 0;
	for (let i = 0; i < 5; i++) {
		results += await iterate();
	}

	closeClients();
	server.close();

	console.log(`平均用时：${results / 5}ms`);
}

server.listen(0, run);
