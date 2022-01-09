import { extname } from "path";
import { LoadRequest, MediaService, SaveRequest } from "./MediaService";
import { BadDataError } from "./errors";

/**
 * 就是简单地把请求转发到 RasterOptimizer 或 SVGOptimizer。
 */
export default class DispatchService implements MediaService {

	private readonly fallback: MediaService;
	private readonly map: Record<string, MediaService>;

	constructor(fallback: MediaService, map: Record<string, MediaService> = {}) {
		this.map = map;
		this.fallback = fallback;
	}

	private getService(type: string) {
		const service = this.map[type];
		if (service) {
			return service;
		}
		if (this.fallback) {
			return this.fallback;
		}
		throw new BadDataError("不支持的类型" + type);
	}

	load(request: LoadRequest) {
		const type = extname(request.name);
		return this.getService(type).load(request);
	}

	save(request: SaveRequest) {
		return this.getService(request.type).save(request);
	}
}
