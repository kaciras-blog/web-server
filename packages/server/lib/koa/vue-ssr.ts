import { basename, extname, resolve } from "path";
import { readFileSync } from "fs";
import { Context } from "koa";
import log4js from "log4js";
import AppBuilder from "../AppBuilder.js";

const logger = log4js.getLogger("SSR");

/**
 * ssrManifest 选项生成的文件，Vite 没有这个的类型。
 */
export type SSRManifest = Record<string, string[]>;

export interface RenderContext {

	/**
	 * 状态码，可以在渲染函数中设置，没有则为 200。
	 */
	status?: number;

	/**
	 * 如果有则表示要渲染错误页。
	 */
	readonly error?: Error;

	/**
	 * 原始请求，仅用于传递用户身份信息，请勿修改。
	 */
	readonly request: Context;

	/**
	 * 请求页面的完整路径，包含 query 部分。
	 * 例如 "/about/me?start=20&count=20#friends"
	 */
	readonly path: string;
}

/**
 * 服务端渲染函数，接收上下文对象，返回渲染出来的 HTML。
 */
export type SSRenderer = (ctx: RenderContext) => Promise<string>;

/**
 * 服务端入口的默认导出，用于初始化渲染函数的函数。
 *
 * 因为渲染所用的参数的生命周期分两种：
 * 1）启动后就不变的，主要是构建结果和选项。
 * 2）请求相关的，包括 URL、Cookie 等。
 *
 * 所以把服务端函数也分两个，对应上述的两类参数。
 *
 * @param template HTML 模板
 * @param manifest 资源清单，包含了每个模块的依赖模块列表。
 */
export type SSREntry = (template: string, manifest: SSRManifest) => SSRenderer;

/**
 * 在服务端渲染页面，如果出现了异常，则渲染错误页面并设置对应的状态码。
 *
 * <h2>代码结构</h2>
 * 新版将渲染过程全放入服务端入口，此处仅负责与 Koa 连接。
 * 这样整个页面相关的逻辑都在一起运行，耦合度更低，也避免了导入不一致的问题。
 *
 * @param ctx HTTP 请求上下文
 * @param entry 服务端入口
 */
export async function renderSSR(ctx: Context, entry: SSRenderer) {
	const renderCtx: RenderContext = {
		request: ctx,
		path: ctx.url,
	};

	try {
		ctx.body = await entry(renderCtx);
		ctx.status = renderCtx.status ?? 200;
	} catch (e) {
		switch (e.code) {
			case 301:
			case 302:
				ctx.status = e.code;
				ctx.redirect(e.location);
				return;
		}

		ctx.status = 503;
		ctx.body = await entry({
			error: e,
			...renderCtx,
		});

		logger.error("服务端渲染出错", e);
	}
}

/**
 * 使用构建结果来创建服务端渲染器，用于生产模式。
 *
 * @param outputDir 构建的输出目录
 * @param ssr 服务端入口的源文件名
 */
export async function productionSSRPlugin(outputDir: string, ssr: string) {

	function read(file: string) {
		return readFileSync(resolve(outputDir, file), "utf8");
	}

	let url = basename(ssr, extname(ssr)) + ".js";
	url = "file://" + resolve(outputDir, "server/" + url);
	const createServerRenderer = (await import(url)).default as SSREntry;

	const render = createServerRenderer(
		read("client/index.html"),
		JSON.parse(read("client/ssr-manifest.json")),
	);

	return (api: AppBuilder) => api.useFallBack(ctx => renderSSR(ctx, render));
}
