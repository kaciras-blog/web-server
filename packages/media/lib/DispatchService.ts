import { extname } from "path";
import { LoadRequest, MediaService, SaveRequest } from "./MediaService";
import { BadDataError } from "./errors";

type DispatchMap = Record<string, MediaService>;

/**
 * 根据资源的类型将请求转发到不同后端服务的服务，下载时使用扩展名作为类型。
 */
export default class DispatchService implements MediaService {

	private readonly fallback?: MediaService;
	private readonly map: Record<string, MediaService>;

	constructor(map: DispatchMap = {}, fallback?: MediaService) {
		this.map = map;
		this.fallback = fallback;
	}

	private getService(type: string) {
		const service = this.map[type] ?? this.fallback;
		if (service) {
			return service;
		}
		throw new BadDataError("不支持的类型：" + type);
	}

	// 因为存在同步抛异常的情况，下面两个方法的 async 不能省略。

	async load(request: LoadRequest) {
		const type = extname(request.name).slice(1);
		return this.getService(type).load(request);
	}

	async save(request: SaveRequest) {
		return this.getService(request.type).save(request);
	}
}
