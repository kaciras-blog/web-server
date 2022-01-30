import { resolve } from "path";
import { readFileSync } from "fs";
import { Context } from "koa";
import log4js from "log4js";
import AppBuilder from "../AppBuilder.js";

const logger = log4js.getLogger("SSR");

/**
 * ssrManifest 选项生成的文件，Vite 没有这个的类型。
 */
type SSRManifest = Record<string, string[]>;

export interface BlogSSRResult  {

	/** 渲染出来的 HTML 结果 */
	html: string;

	/** 状态码，如果没有则为 200 */
	status?: number;
}

export interface RequestContext {

	/**
	 * 请求页面的完整路径，包含 query 部分。
	 */
	path: string;

	/**
	 * HTML 模板，由客户端构建生成。
	 */
	template: string;

	/**
	 * 资源清单，包含了每个模块的依赖模块列表。
	 */
	manifest: SSRManifest;

	/**
	 * 原始请求，仅用于传递用户身份信息，请勿修改。
	 */
	request: Context;
}

export type SSREntry = (context: RequestContext) => Promise<BlogSSRResult>;

/**
 * 在服务端渲染页面，如果出现了异常，则返回错误页面并设置对应的状态码。
 *
 * <h2>代码结构</h2>
 * 新版将渲染 App 的部分放入构建内，此处只处理 HTML 部分，
 * 这样整个 Vue 生态都在一起运行，耦合度更低，也避免了导入不一致的问题。
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
	const renderCtx: RequestContext = {
		template,
		manifest,
		path: ctx.url,
		request: ctx,
	};

	try {
		const result = await entry(renderCtx);
		ctx.body = result.html;
		ctx.status = result.status ?? 200;
	} catch (e) {
		switch (e.code) {
			case 301:
			case 302:
				ctx.status = e.code;
				ctx.redirect(e.location);
				return;
		}

		const result = await entry({
			...renderCtx,
			path: "/error/500",
		});
		ctx.status = 503;
		ctx.body = result.html;

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
	const render = (await import(url)).default.default;

	return (api: AppBuilder) => api.useFallBack((ctx) => {
		return renderSSR(ctx, template, render, manifest);
	});
}
