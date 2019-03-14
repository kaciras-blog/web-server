import axios from "axios";
import fs from "fs-extra";
import { sha3_256 } from "js-sha3";
import koaSend from "koa-send";
import { Context, Middleware } from "koa";
import { getLogger } from "log4js";
import path from "path";
import xml2js from "xml2js";
import mime from "mime-types";

const logger = getLogger("Blog");


/**
 * 能够发送一个位于网站内容目录下的静态文件。
 *
 * @param path_ 文件路径，是URL中的path部分，以/开头
 * @param options 选项
 * @return 中间件函数
 */
export function staticFile (path_: string, options: any): Middleware {
	if (path_.startsWith("/static/")) {
		throw new Error("静态文件目录请用 koa-static 处理");
	}
	return (ctx, next) => {
		if (ctx.path !== path_) {
			return next();
		}
		if (ctx.method !== "GET") {
			ctx.status = 405;
			return Promise.resolve();
		}
		return koaSend(ctx, path_, { root: options.contentRoot });
	};
}

/**
 * 拦截文件，请求Path包含在列表中将返回404。
 *
 * @param files 文件列表
 * @return Koa 的中间件函数
 */
export function intercept (files: string[]): Middleware {
	return (ctx, next) => {
		if (!files.includes(ctx.path)) {
			return next();
		}
		ctx.status = 404;
		return Promise.resolve();
	};
}

export interface ImageMiddlewareOptions {
	imageRoot: string;
	cacheMaxAge: number;
}

/**
 * 根据指定的选项创建中间件。
 * 返回Koa的中间件函数，用法举例：app.use(require("./image")(options));
 *
 * @param options 选项
 * @return Koa的中间件函数
 */
export function createImageMiddleware (options: ImageMiddlewareOptions): Middleware {
	const SUPPORTED_FORMAT = ["jpg", "png", "gif", "bmp", "svg"];
	fs.ensureDirSync(options.imageRoot);

	async function getImage (ctx: Context): Promise<void> {
		const name = ctx.path.substring("/image/".length);
		if (!name || /[\\/]/.test(name)) {
			ctx.status = 404;
		} else {
			await koaSend(ctx, name, { root: options.imageRoot, maxage: options.cacheMaxAge });
		}
	}

	/**
	 * 接收上传的图片，文件名为图片内容的SHA3值，扩展名取决于内容的 MIME-TYPE。
	 * 如果图片已存在则直接返回，否则将保存文件，保存的文件的URL由Location响应头返回。
	 *
	 * @param ctx 请求上下文
	 */
	async function uploadImage (ctx: Context) {
		logger.trace("有图片正在上传");

		// Multer 库直接修改ctx.req
		const file = (ctx.req as any).file;
		if (!file) {
			return ctx.status = 400;
		}

		// mime.extension() 对 undefined 以及不支持的返回 false
		let ext = mime.extension(file.mimetype);
		if (ext === "jpeg") {
			ext = "jpg"; // 统一使用JPG
		} else if (!ext) {
			return ctx.status = 400;
		}

		if (SUPPORTED_FORMAT.indexOf(ext) < 0) {
			return ctx.status = 400;
		}

		const name = sha3_256(file.buffer) + "." + ext;
		const store = path.join(options.imageRoot, name);

		if (await fs.pathExists(store)) {
			ctx.status = 200;
		} else {
			logger.debug("保存上传的图片:", name);
			await fs.writeFile(store, file.buffer);
			ctx.status = 201;
		}

		// 保存的文件名通过 Location 响应头来传递
		ctx.set("Location", "/image/" + name);
	}

	return (ctx, next) => {
		if (!ctx.path.startsWith("/image")) {
			return next();
		} else if (ctx.method === "GET") {
			return getImage(ctx);
		} else if (ctx.method === "POST") {
			return uploadImage(ctx);
		}
		ctx.status = 405;
	};
}


/** 文章列表响应的一部分字段 */
interface ArticlePreview {
	id: number;
	urlTitle: string;
	update: string;  // 格式：yyyy-MM-dd HH:mm
}

class ArticleCollection {

	public static convert (art: ArticlePreview) {
		const parts = art.update.split(/[- :]/g);
		const date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1,
			parseInt(parts[2]), parseInt(parts[3]), parseInt(parts[4]));

		return {
			loc: `https://blog.kaciras.net/article/${art.id}/${art.urlTitle}`,
			changefreq: "monthly",
			lastmod: date.toISOString().split(".")[0] + "Z",
			priority: 0.5,
		};
	}

	private readonly urlPrefix: string;

	/**
	 * 创建一个文章集合，从指定的服务器上获取文章列表。
	 *
	 * @param urlPrefix 后端服务器URL前缀
	 */
	constructor (urlPrefix: string) {
		this.urlPrefix = urlPrefix;
	}

	public async getItems () {
		const res = await axios.get(this.urlPrefix + "/articles", {
			params: {
				count: 20,
				sort: "update_time",
				desc: true,
			},
		});
		if (res.status !== 200) {
			throw new Error("Api server response status: " + res.status);
		}
		return res.data.map(ArticleCollection.convert);
	}
}


/** 由资源集合构建 sitemap.xml 的内容 */
async function buildSitemap (resources: ArticleCollection[]) {
	const sitemapBuilder = new xml2js.Builder({
		rootName: "urlset",
		xmldec: { version: "1.0", encoding: "UTF-8" },
	});

	const urlset: string[] = [];
	for (const res of resources) {
		urlset.push.apply(urlset, await res.getItems());
	}

	return sitemapBuilder.buildObject(urlset.map((item) => ({ url: item })));
}

export function createSitemapMiddleware (serverAddress: string): Middleware {
	let cached: string;

	const resources: ArticleCollection[] = [];
	resources.push(new ArticleCollection(serverAddress));

	function updateCache () {
		buildSitemap(resources)
			.then((siteMap) => cached = siteMap)
			.catch((err) => logger.error("创建站点地图失败：", err.message));
	}

	updateCache(); // 启动时先创建一个存着

	return function handle (ctx, next) {
		if (ctx.path !== "/sitemap.xml") {
			return next();
		}
		updateCache();
		if (cached == null) {
			ctx.status = 404;
		} else {
			ctx.type = "application/xml; charset=utf-8";
			ctx.body = cached;
		}
	};
}
