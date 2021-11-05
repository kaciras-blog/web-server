import { basename, extname } from "path";
import { BadDataError } from "./errors";
import { hashName } from "./common";
import { LoadRequest, SaveRequest, WebFileService } from "./WebFileService";
import { FileStore } from "./FileStore";

function stem(name: string) {
	return basename(name, extname(name));
}

interface SaveParams {

	codec?: string;

	/**
	 * 变体标识，为已上传视频的文件名，该参数表示新上传的视频将作已存在视频的变体，
	 * 它将具有与其同样的访问 URL，在下载时智能选择。
	 */
	variant?: string;
}

/**
 * 多版本存储策略，
 *
 * <h1>客户端转码</h1>
 * 由于视频转码很费时，放在服务端占用大量资源，所以暂未支持视频的优化。
 * 这里选择让用户自己转码，然后上传同一视频的多个版本。
 *
 * <h1>内容一致性</h1>
 * 需要注意视频转码是有损的，这意味着难以检测上传的多个版本是否包含相同的内容，
 * 如果上传了不同的视频作为变体，则不同的浏览器可能访问到不同的内容。
 *
 * <h1>文件有效性</h1>
 * file-type 之类的使用文件头的库会更好些。
 * 但即便检查了文件头，仍不能保证内容有效，除非完整地解码。
 */
export default class VariantService implements WebFileService {

	private readonly store: FileStore;
	private readonly typeList: string[];

	constructor(store: FileStore, codecs: string[]) {
		this.store = store;
		this.typeList = codecs;
	}

	async load(request: LoadRequest) {
		const { store, typeList } = this;
		const { name, codecs } = request;

		const candidates = typeList.filter(c => codecs.includes(c));
		candidates.push("mp4");

		const hash = basename(name, extname(name));
		for (const type of candidates) {
			const file = await store.load(hash + "." + type);
			if (file !== null) {
				return { file, mimetype: "video/mp4" };
			}
		}
	}

	async save(request: SaveRequest<SaveParams>) {
		const { buffer, mimetype, parameters } = request;
		if (mimetype !== "video/mp4") {
			throw new BadDataError("仅支持 mp4 容器格式");
		}

		const { variant, codec } = parameters;
		if (codec && !this.typeList.includes(codec)) {
			throw new BadDataError("不支持的视频格式：" + codec);
		}

		let name = variant ? stem(variant) : hashName(buffer);
		name = name + "." + (codec ?? "mp4");
		return this.store.save(buffer, name).then(() => ({ url: name }));
	}
}
