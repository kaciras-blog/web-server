import { resolve } from "path";
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

	/**
	 * HTML 模板，由客户端构建生成。
	 */
	readonly template: string;

	/**
	 * 资源清单，包含了每个模块的依赖模块列表。
	 * 由 Vite的 Vue 插件在 SSR 时生成。
	 */
	readonly manifest: SSRManifest;
}

/**
 * 服务端渲染函数，返回渲染出来的 HTML 结果。
 */
export type SSREntry = (ctx: RenderContext) => Promise<string>;

/**
 * 在服务端渲染页面，如果出现了异常，则渲染错误页面并设置对应的状态码。
 *
 * <h2>代码结构</h2>
 * 新版将渲染过程全放入服务端入口，此处仅负责与 Koa 连接。
 * 这样整个页面相关的逻辑都在一起运行，耦合度更低，也避免了导入不一致的问题。
 *
 * @param ctx HTTP 请求上下文
 * @param template HTML 模板
 * @param entry 服务端入口
 * @param manifest 资源清单
 */
export async function renderSSR(
	ctx: Context,
	template: string,
	entry: SSREntry,
	manifest: SSRManifest,
) {
	const renderCtx: RenderContext = {
		template,
		manifest,
		path: ctx.url,
		request: ctx,
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
 * 使用指定目录下的构建结果来创建服务端渲染器。
 *
 * @param distDir 构建的输出目录
 */
export async function productionSSRPlugin(distDir: string) {

	function getPath(file: string) {
		return resolve(distDir, file);
	}

	function read(file: string) {
		return readFileSync(getPath(file), "utf8");
	}

	const template = read("client/index.html");
	const manifest = JSON.parse(read("server/ssr-manifest.json"));
	const url = "file://" + getPath("server/entry-server.js");
	const render = (await import(url)).default;

	return (api: AppBuilder) => api.useFallBack((ctx) => {
		return renderSSR(ctx, template, render, manifest);
	});
}
