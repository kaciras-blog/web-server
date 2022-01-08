import { basename, extname } from "path";
import { BadDataError, ParamsError } from "./errors";
import { hashName } from "./common";
import { LoadRequest, SaveRequest, WebFileService } from "./WebFileService";
import { FileStore } from "./FileStore";
import mime from "mime-types";

function splitName(name: string) {
	const ext = extname(name);
	return [basename(name, ext), ext];
}

function fileOf(base: string, ext: string, codec?: string) {
	return codec ? `${base}.${codec}${ext}` : base + ext;
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
 * 多版本存储策略，支持上传同一个资源的多个版本，下载时自动选择最优的。
 *
 * 比如视频转码很费时，放在服务端占用大量资源，可以选择让用户自己转码，
 * 然后上传同一视频的多个版本。
 *
 * <h2>文件安全性</h2>
 * 该服务不会检查文件内容，也就存在上传恶意文件的风险，请用于可信来源。
 * file-type 之类的库会更好些，但即便检查了文件头，仍不能保证内容有效，除非完整地解码。
 *
 * <h2>不区分原始版本</h2>
 * 因为都是用户上传的，没法判断那个是原版，所以不支持获取原始版本。
 *
 * <h2>内容一致性</h2>
 * 需要注意视频转码是有损的，这意味着难以检测上传的多个版本是否包含相同的内容，
 * 如果上传了不同的视频作为变体，则不同的浏览器可能访问到不同的内容。
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
		candidates.push("");

		const [base, ext] = splitName(name);
		const mimetype = mime.lookup(ext);

		if (!mimetype) {
			throw new ParamsError("文件名错误");
		}

		for (const codec of candidates) {
			const filename = fileOf(base, ext, codec);
			const file = await store.load(filename);
			if (file !== null) {
				return { file, mimetype };
			}
		}
	}

	async save(request: SaveRequest<SaveParams>) {
		const { buffer, mimetype, parameters } = request;
		const { variant, codec } = parameters;

		if (codec && !this.typeList.includes(codec)) {
			throw new BadDataError("不支持的编码：" + codec);
		}

		let name: string;
		if (variant) {
			const [base, ext] = splitName(variant);
			name = fileOf(base, ext, codec);
		} else {
			const base = hashName(buffer);
			const ext = mime.extension(mimetype);

			if (!ext) {
				throw new ParamsError("不支持的格式" + mimetype);
			}
			name = fileOf(base, "." + ext, codec);
		}

		return this.store.save(name, buffer).then(() => name);
	}
}
