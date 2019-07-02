/*
 * 修改 Axios 使其支持内置 Node 的 http2 模块。
 * 【警告】Axios 0.19.0 不合并默认配置里的transport（axios/lib/core/mergeConfig.js），所以不能升级。
 */
import Axios, { AxiosInstance } from "axios";
import http2, { IncomingHttpHeaders, IncomingHttpStatusHeader, SecureClientSessionOptions } from "http2";
import fs from "fs-extra";
import { type } from "os";

/**
 * 修改指定 Axios 实例的 transport 配置，使其使用 NodeJS 的 http2 模块发送请求。
 *
 * @param axios Axios实例
 * @param https transport 的参数里竟然不带协议？还得手动指定下
 * @param connectOptions 传递到 http2.connect 的选项
 */
export function adaptAxiosHttp2(axios: AxiosInstance, https = false, connectOptions?: SecureClientSessionOptions) {
	const schema = https ? "https" : "http";

	function request(options: any, callback: any) {
		let origin = `${schema}://${options.hostname}`;
		if (options.port) {
			origin += ":" + options.port;
		}

		const client = http2.connect(origin, connectOptions);
		const req: any = client.request({
			...options.headers,
			":method": options.method.toUpperCase(),
			":path": options.path,
		});

		req.on("response", (headers: IncomingHttpHeaders & IncomingHttpStatusHeader) => {
			req.headers = headers;
			req.statusCode = headers[":status"];
			callback(req);
		});
		req.on("end", () => client.close());
		return req;
	}

	// 修改Axios默认的transport属性，注意该属性是内部使用没有定义在接口里
	(axios.defaults as any).transport = { request };
}

/**
 * 配置全局Axios实例的便捷函数。
 *
 * @param https 因为Axios的蛋疼设计，必须在这里指定是否用HTTPS
 * @param trusted 信任的证书，或是true忽略证书检查
 */
export async function configureGlobalAxios(https?: boolean, trusted?: string | true) {
	if (typeof trusted === "string") {
		const ca = await fs.readFile(trusted);
		adaptAxiosHttp2(Axios, true, { ca });
	} else {
		if (trusted) {
			process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
		}
		adaptAxiosHttp2(Axios, true);
	}
}
