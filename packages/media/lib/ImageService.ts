import { extname } from "path";
import { LoadRequest, SaveRequest, WebFileService } from "./WebFileService";
import { FileStore } from "./FileStore";
import SVGOptimizer from "./image/SVGOptimizer";
import RasterOptimizer from "./image/RasterOptimizer";
import CachedService from "./image/CachedService";

/**
 * 就是简单地把请求转发到 RasterOptimizer 或 SVGOptimizer。
 */
export default class ImageService implements WebFileService {

	private readonly svgService: WebFileService;
	private readonly rasterService: WebFileService;

	constructor(store: FileStore) {
		this.svgService = new CachedService(store, new SVGOptimizer(store));
		this.rasterService = new CachedService(store, new RasterOptimizer(store));
	}

	save(request: SaveRequest) {
		if (request.mimetype === "image/svg+xml") {
			return this.svgService.save(request);
		} else {
			return this.rasterService.save(request);
		}
	}

	load(request: LoadRequest) {
		if (extname(request.name) === "svg") {
			return this.svgService.load(request);
		} else {
			return this.rasterService.load(request);
		}
	}
}
