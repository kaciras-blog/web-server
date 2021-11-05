import { extname } from "path";
import { LoadRequest, SaveRequest, WebFileService } from "./WebFileService";
import { FileStore } from "./FileStore";
import SVGService from "./image/SVGService";
import RasterService from "./image/RasterService";

/**
 * 就是简单地把请求转发到 RasterService 或 SVGService。
 */
export default class ImageService implements WebFileService {

	private readonly svgService: SVGService;
	private readonly rasterService: RasterService;

	constructor(store: FileStore) {
		this.svgService = new SVGService(store);
		this.rasterService = new RasterService(store);
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
