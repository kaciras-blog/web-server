/**
 * koa-static 和 koa-send 扩展性不能满足本项目的需要，特别是升级规则，所以就自己撸一个。
 *
 * 主要参考了它俩的设计：
 * https://github.com/koajs/send
 * https://github.com/koajs/static
 */
import { extname, join, normalize, parse, resolve, sep } from "path";
import { BaseContext, Middleware } from "koa";
import fs from "fs-extra";
import replaceExt from "replace-ext";
import createError from "http-errors";

interface Options {

	/**
	 * 自定义修改相应的方法，在处理的最后调用，此时文件已确定，相关头部也都设置好了。
	 * 通常用来设置缓存，或者其它自定义的响应头部。
	 *
	 * 【为什么不用中间件来做】
	 * 中间件难以获取执行细节，如被选中的文件，和是否在本中间件返回。
	 *
	 * @param ctx Koa上下文
	 * @param filename 发送的文件的完整路径
	 * @param stats 文件属性
	 */
	customResponse?: (ctx: BaseContext, filename: string, stats: fs.Stats) => void;
}

/**
 * 包含一类文件的选择逻辑，接受请求时将使用该类来选择文件回复。
 * 本接口主要用于渐进升级，比如客户端支持 gzip 时发送压缩的版本。
 */
interface FileSelector {

	/**
	 * 尝试选择一个文件，如果客户端支持则返回文件名，否则返回 falsy 的值。
	 *
	 * @param ctx Koa上下文
	 * @param path 请求的文件路径
	 */
	select(ctx: BaseContext, path: string): string | false | undefined;

	/**
	 * 已确定使用被选中的文件，设置相关的 Content-* 头。
	 *
	 * @param ctx Koa上下文
	 * @param path 请求的文件路径
	 */
	setHeaders(ctx: BaseContext, path: string): void;
}

/**
 * 文件类型升级，如果 Accept 请求头接受指定的类型，则尝试选用该类型的文件。
 * 升级版文件替换了原文件的扩展名，例如 image.png -> image.webp
 */
class TypeUpgrade implements FileSelector {

	private readonly name: string;
	private readonly extension: string;

	/**
	 * @param name 文件的 MIME 类型
	 * @param extension 替换的扩展名
	 */
	constructor(name: string, extension: string) {
		this.name = name;
		this.extension = extension;
	}

	select(ctx: BaseContext, path: string) {
		const support = ctx.accepts().includes(this.name);
		return support && replaceExt(path, this.extension);
	}

	setHeaders(ctx: BaseContext, path: string) {
		ctx.type = this.name;
	}
}

/**
 * 编码升级，如果 Accept-Encoding 请求头接受指定的类型，则尝试选用该类型的文件。
 * 升级版文件将扩展名附加到原文件名之后，例如 index.html -> index.html.br
 */
class EncodingUpgrade implements FileSelector {

	private readonly name: string;
	private readonly extension: string;

	/**
	 * @param name 编码名，也是 Content-Encoding 的值
	 * @param extension 附加的扩展名
	 */
	constructor(name: string, extension: string) {
		this.name = name;
		this.extension = extension;
	}

	select(ctx: BaseContext, path: string) {
		const { name, extension } = this;
		const support = ctx.acceptsEncodings(name, "identity") === name;
		return support && path + extension;
	}

	setHeaders(ctx: BaseContext, path: string) {
		ctx.type = extname(path);
		ctx.set("Content-Encoding", this.name);
	}
}

/**
 * 默认规则，直接选用路径所对应的文件，从文件扩展名中获取 MIME 类型。
 */
class DefaultFileSelector implements FileSelector {

	select(ctx: BaseContext, path: string) {
		return path;
	}

	setHeaders(ctx: BaseContext, path: string) {
		ctx.type = extname(path);
	}
}

/**
 * 选择器列表，用于发送优化版的文件，靠前的优先。
 */
const selectors: FileSelector[] = [
	new TypeUpgrade("image/avif", ".avif"),
	new TypeUpgrade("image/webp", ".webp"),
	new EncodingUpgrade("br", ".br"),
	new EncodingUpgrade("gzip", ".gz"),
	new DefaultFileSelector(),
];

const UP_PATH_REGEXP = /(?:^|[\\/])\.\.(?:[\\/]|$)/;

const NOT_FOUND = ["ENOENT", "ENAMETOOLONG", "ENOTDIR"];

/**
 * Resolve relative path against a root path.
 *
 * 源代码来自：https://github.com/pillarjs/resolve-path
 * 因为原作者没有添加Typescript定义所以就抄过来了，删除了多余的检查。
 */
function resolvePath(root: string, path: string) {
	path = path.slice(parse(path).root.length);

	// containing NULL bytes is malicious
	if (path.indexOf("\0") !== -1) {
		throw createError(400, "Malicious Path");
	}

	// path outside root
	if (UP_PATH_REGEXP.test(normalize("." + sep + path))) {
		throw createError(403);
	}

	// join the relative path
	return normalize(join(resolve(root), path));
}

/**
 * 发送一个本地文件，支持一些升级规则。
 *
 * @param path 要发送的文件路径
 * @param options 选项
 * @param ctx Koa 上下文
 */
export async function send(ctx: BaseContext, path: string, options: Options = {}) {
	let file: string | false | undefined;
	let stats: fs.Stats;

	for (const s of selectors) {
		const selected = s.select(ctx, path);
		if (!selected) {
			continue;
		}
		try {
			stats = await fs.stat(selected);
			if (!stats.isDirectory()) {
				file = selected;
				s.setHeaders(ctx, path);
				break;
			}
		} catch (err) {
			if (NOT_FOUND.includes(err.code)) {
				continue;
			}
			err.status = 500;
			throw err; // 这个异常不好做测试
		}
	}

	if (file) {
		ctx.set("Content-Length", stats!.size.toString());
		ctx.set("Last-Modified", stats!.mtime.toUTCString());
		ctx.body = fs.createReadStream(file);

		options.customResponse?.(ctx, file, stats!);
	}
}

/**
 * 处理 Koa 请求，如果该请求访问了本地文件则发送，否则调用下一个中间件。
 *
 * @param root 本地文件目录
 * @param options 选项
 */
export default function (root: string, options: Options = {}): Middleware {
	return async (ctx, next) => {
		switch (ctx.method) {
			case "HEAD":
			case "GET":
			case "OPTIONS":
				break;
			default:
				return next();
		}

		let { path } = ctx;
		try {
			path = decodeURIComponent(path);
		} catch (e) {
			ctx.throw(400, "failed to decode");
		}
		path = resolvePath(root, path);

		await send(ctx, path, options);

		// 如果前面的中间件设置了 body 则会出问题，但应该没这种情况。
		if (!ctx.body) return next();
	};
}
