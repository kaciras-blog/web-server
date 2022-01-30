import { basename, resolve } from "path";
import { readFileSync } from "fs";
import { Context } from "koa";
import log4js from "log4js";
import { SSRContext } from "@vue/server-renderer";
import AppBuilder from "../AppBuilder.js";

const logger = log4js.getLogger("SSR");

export interface BlogSSRContext extends SSRContext {

	/** 标题元素，如果有则替换 HTML 中的 */
	title?: string;

	/** 插入到页面头的一些元素 */
	meta?: string;

	/** 如果路由结果为 404 错误页则为 true */
	status?: number;

	/** 该页面引用的所有模块，用于生成预载标签 */
	modules: Set<string>;
}

export interface RequestContext {

	/**
	 * 页面的完整URL，可以从中获取 origin、query 等信息，而 VueRouter 只有 path。
	 *
	 * 因为 NodeJS 的 URL 类并不在全局域，所以在这里传递以免在前端代码里 require("url")。
	 * URL 的成员类似 Location，要获取字符串形式的可以用 URL.toString()。
	 */
	url: string;

	/** 原始请求，仅用于传递用户身份信息。 */
	request: Context;
}

type SSREntry = (context: RequestContext) => Promise<[string, BlogSSRContext]>;

const titleRE = new RegExp("<title>[^<]*</title>");

/**
 * 在服务端渲染页面，如果出现了异常，则返回错误页面并设置对应的状态码。
 *
 * <h2>代码结构</h2>
 * 新版将渲染 App 的部分放入构建内，此处只处理 HTML 部分，
 * 这样整个 Vue 生态都在一起运行，耦合度更低，也避免了导入不一致的问题。
 *
 * @param template HTML 模板
 * @param entry 服务端入口
 * @param manifest 资源清单
 * @param ctx HTTP 请求上下文
 */
export async function renderSSR(template: string, entry: SSREntry, manifest: any, ctx: Context) {
	const renderContext: RequestContext = {
		url: ctx.url,
		request: ctx,
	};

	try {
		const [result, ssrContext] = await entry(renderContext);
		const preloads = renderPreloadLinks(ssrContext.modules, manifest);

		ctx.body = template
			.replace("<!--ssr-metadata-->", ssrContext.meta ?? "")
			.replace("<!--app-html-->", result)
			.replace("<!--preload-links-->", preloads);

		if (ssrContext.title) {
			template.replace(titleRE, ssrContext.title);
		}
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
			request: ctx,
			url: "/error/500",
		});

		logger.error("服务端渲染出错", e);
	}
}

/**
 * https://github.com/vitejs/vite/blob/main/packages/playground/ssr-vue/src/entry-server.js
 *
 * @param modules
 * @param manifest
 */
function renderPreloadLinks(modules: any, manifest: any) {
	let links = "";
	const seen = new Set();
	modules.forEach((id: string) => {
		const files = manifest[id];
		if (files) {
			files.forEach((file: string) => {
				if (!seen.has(file)) {
					seen.add(file);
					const filename = basename(file);
					if (manifest[filename]) {
						for (const depFile of manifest[filename]) {
							links += renderPreloadLink(depFile);
							seen.add(depFile);
						}
					}
					links += renderPreloadLink(file);
				}
			});
		}
	});
	return links;
}

function renderPreloadLink(file: string) {
	if (file.endsWith(".js")) {
		return `<link rel="modulepreload" crossorigin href="${file}">`;
	} else if (file.endsWith(".css")) {
		return `<link rel="stylesheet" href="${file}">`;
	} else if (file.endsWith(".woff")) {
		return ` <link rel="preload" href="${file}" as="font" type="font/woff" crossorigin>`;
	} else if (file.endsWith(".woff2")) {
		return ` <link rel="preload" href="${file}" as="font" type="font/woff2" crossorigin>`;
	} else if (file.endsWith(".gif")) {
		return ` <link rel="preload" href="${file}" as="image" type="image/gif">`;
	} else if (file.endsWith(".jpg") || file.endsWith(".jpeg")) {
		return ` <link rel="preload" href="${file}" as="image" type="image/jpeg">`;
	} else if (file.endsWith(".png")) {
		return ` <link rel="preload" href="${file}" as="image" type="image/png">`;
	} else {
		return "";
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
	const createApp = (await import(url)).default.default;

	return (api: AppBuilder) => api.useFallBack((ctx) => {
		return renderSSR(template, createApp, manifest, ctx);
	});
}
