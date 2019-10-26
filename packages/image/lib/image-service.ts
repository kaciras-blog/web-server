import crypto from "crypto";
import { performance } from "perf_hooks";
import { promisify } from "util";
import sharp from "sharp";
import { brotliCompress, InputType } from "zlib";
import SVGO from "svgo";
import { getLogger } from "log4js";
import { ImageFilter, ImageTags, runFilters } from "./filter-runner";
import codingFilter from "./coding-filter";
import { ImageStore, LocalFileSlot } from "./image-store";
import { BadImageError, ImageFilterException } from "./exceptions";


const logger = getLogger("Image");

const brotliCompressAsync = promisify<InputType, Buffer>(brotliCompress);
const svgOptimizer = new SVGO();

const filters = new Map<string, ImageFilter>();
filters.set("type", codingFilter);

const SVG_COMPRESS_THRESHOLD = 1024;

/**
 * 能够处理的输入图片格式。
 * 不支持WebP作为输入，因为很难从WebP转换回传统格式。
 */
const INPUT_FORMATS = ["jpg", "png", "gif", "bmp", "svg"];

interface WebImageAttribute {
	encoding?: string;
}

interface WebImageOutput extends WebImageAttribute {
	path: string;
}

/**
 * 预先生成适用于web图片的服务，在保存图片的同时生成针对web优化的缓存图，读取时根据
 * 选项选择最佳的图片。
 *
 * 预先生成的优点是缓存一定命中，没有实时生成的等待时间。而另一种做法是实时生成，
 * 大多数图片服务像twitter的都是这种，其优点是更加灵活、允许缓存过期节省空间。
 * 考虑到个人博客不会有太多的图，而且廉价VPS的性能也差，所以暂时选择了预先生成。
 */
export class PreGenerateImageService {

	private readonly store: ImageStore;

	constructor(store: ImageStore) {
		this.store = store;
	}

	/**
	 * 保存图片，并生成缓存。
	 *
	 * @param buffer 图片数据
	 * @param type 图片类型
	 * @return 用于查询该图片的文件名
	 */
	async save(buffer: Buffer, type: string) {
		if (type === "jpeg") {
			type = "jpg";
		}
		if (INPUT_FORMATS.indexOf(type) < 0) {
			throw new BadImageError(`不支持的图片格式：${type}`);
		}

		if (type === "bmp") {
			type = "png";
			buffer = await sharp(buffer).png().toBuffer();
		}

		// TODO: hex好长，要不要换base64截断一下
		const hash = crypto
			.createHash("sha3-256")
			.update(buffer)
			.digest("hex");

		const slot = this.store({ name: hash, type });
		const fullName = `${hash}.${type}`;

		if (await slot.exists()) {
			logger.debug(`图片 ${fullName} 已经存在，跳过处理和保存的步骤`);
		} else {
			const start = performance.now();
			await this.saveNewImage(slot, hash, type, buffer);
			const time = performance.now() - start;
			logger.info(`处理图片 ${fullName} 用时 ${time.toFixed()}ms`);
		}

		return fullName;
	}

	/**
	 * 根据提供的选项来获取指定的图片，优先选择最优化的缓存图。
	 * 如果没有生成缓存则无法获取图片，因为原图不在候选列表中，原图仅用于备份以及生成缓存。
	 *
	 * @param name 图片名
	 * @param type 图片类型
	 * @param webp 是否支持WebP格式
	 * @param brotli 是否支持Brotli压缩
	 * @return 图片信息，如果没有该图的缓存则返回null
	 */
	get(name: string, type: string, webp: boolean, brotli: boolean): Promise<WebImageOutput | null> {
		const slot = this.store({ name, type });
		let selectTask = Promise.resolve<WebImageOutput | null>(null);

		const addCandidate = (tags: ImageTags, attrs?: WebImageAttribute) => {

			// 不能使用 file || ... 因为空字符串也是 falsy 的
			function wrapOutput(file: string | null) {
				return file ? Object.assign({ path: file }, attrs) : null;
			}

			selectTask = selectTask.then((file) => file || slot.getCache(tags).then(wrapOutput));
		};

		if (type === "svg") {
			if (brotli) {
				addCandidate({ encoding: "brotli" }, { encoding: "br" });
			}
			addCandidate({});
		} else {
			if (webp) {
				addCandidate({ type: "webp" });
			}
			addCandidate({ type });
		}

		return selectTask;
	}

	private async saveNewImage(slot: LocalFileSlot, hash: string, type: string, buffer: Buffer) {

		const buildCache = async (tags: ImageTags) => {
			try {
				const output = await runFilters(buffer, filters, tags);
				return await slot.putCache(tags, output);
			} catch (error) {
				if (!(error instanceof ImageFilterException)) {
					throw error;
				}
				logger.warn(`忽略转换：${error.message}，hash=${hash}`);
			}
		};

		const tasks: Array<Promise<void>> = [
			slot.save(buffer),
		];

		// 过滤器链只用于光栅图，矢量图我还不知道怎么做裁剪、缩放、加水印等操作，只能压缩一下。
		if (type === "svg") {
			const { data } = await svgOptimizer.optimize(buffer.toString());
			tasks.push(slot.putCache({}, data));

			if (data.length > SVG_COMPRESS_THRESHOLD) {
				const brotli = await brotliCompressAsync(data);
				tasks.push(slot.putCache({ encoding: "brotli" }, brotli));
			}
		} else {
			tasks.push(buildCache({ type }));
			tasks.push(buildCache({ type: "webp" }));
		}

		return Promise.all(tasks);
	}
}
