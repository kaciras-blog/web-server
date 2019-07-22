import http2 from "http2";
import Axios from "axios";
import { adaptAxiosHttp2 } from "../axios-http2";
import { AddressInfo } from "net";

const server = http2.createServer(((request, response) => response.end("benchmark")));

const axios = Axios.create();
adaptAxiosHttp2(axios);

async function run() {
	const url = "http://localhost:" + (server.address() as AddressInfo).port;
	const from = process.hrtime();
	for (let i = 0; i < 1000; i++) {
		const res = await axios.get(url);
		// if (res.status !== 200 || res.data !== "benchmark") {
		// 	throw new Error();
		// }
	}
	const to = process.hrtime();
	return (to[0] - from[0]) * 1000 + (to[1] - from[1]) / 1000000;
}

server.listen(0, () => run().then(console.log).then(() => server.close()));
