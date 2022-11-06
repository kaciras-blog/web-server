import { basename, extname } from "path";
import { BadDataError } from "./errors.js";
import { hashName } from "./common.js";
import { LoadRequest, MediaService, SaveRequest } from "./MediaService.js";
import { FileStore } from "./FileStore.js";

function splitName(name: string) {
	const ext = extname(name);
	return [basename(name, ext), ext.slice(1)];
}

function fileOf(base: string, ext: string, codec?: string) {
	return codec ? `${base}.${codec}.${ext}` : `${base}.${ext}`;
}

interface SaveParams {

	/**
	 * 文件的底层编码，比如 av1,vp9。
	 *
	 * TODO: 多个流都区分编码咋办，比如视频 av1，音频 opus？
	 */
	codec?: string;

	/**
	 * 变体标识，为已上传视频的文件名，该参数表示新上传的视频将作已存在视频的变体，
	 * 它将具有与其同样的访问 URL，在下载时智能选择。
	 */
	variant?: string;
}

/**
 * 多版本存储策略，支持上传同一个资源的多个版本，下载时自动选择最优的。
 *
 * 比如视频转码很费时，放在服务端占用大量资源，可以选择让用户自己转码，
 * 然后上传同一视频的多个版本。
 *
 * <h2>安全性</h2>
 * 目前的实现未检查文件的路径和内容，存在恶意上传的风险，请用于可信来源！
 * file-type 之类的库会更好些，但即便检查了文件头，仍不能保证内容有效，除非完整地解码。
 *
 * <h2>原始版本</h2>
 * 以后要想做自动转码会用到，把旧版手动上传的转成新编码，这需要判断出那个
 * 是原始文件，目前视频较少手动记一下也行。
 *
 * <h2>内容一致性</h2>
 * 需要注意视频转码是有损的，这意味着难以检测上传的多个版本是否包含相同的内容，
 * 如果上传了不同的视频作为变体，则不同的浏览器可能访问到不同的内容。
 */
export default class VariantService implements MediaService {

	private readonly store: FileStore;
	private readonly codecList: string[];

	constructor(store: FileStore, codecs: string[]) {
		this.store = store;
		this.codecList = codecs;
	}

	async load(request: LoadRequest) {
		const { store, codecList } = this;
		const { name, codecs } = request;

		const candidates = codecList.filter(c => codecs.includes(c));
		candidates.push("");

		const [base, type] = splitName(name);

		for (const codec of candidates) {
			const filename = fileOf(base, type, codec);
			const file = await store.load(filename);
			if (file !== null) {
				return { file, type };
			}
		}
	}

	async save(request: SaveRequest<SaveParams>) {
		const { store, codecList } = this;
		const { buffer, type, parameters } = request;
		const { variant, codec } = parameters;

		if (codec && !codecList.includes(codec)) {
			throw new BadDataError("不支持的编码：" + codec);
		}

		let name: string;
		if (variant) {
			const [base, ext] = splitName(variant);
			name = fileOf(base, ext, codec);
		} else {
			const base = hashName(buffer);
			name = fileOf(base, type, codec);
		}

		return store.save(name, buffer).then(() => name);
	}
}
