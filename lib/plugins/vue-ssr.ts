import fs from "fs-extra";
import path from "path";
import { promisify } from "util";
import { createBundleRenderer } from "vue-server-renderer";
import { Context, Middleware } from "koa";
import webpack, { Compiler, Configuration, Plugin } from "webpack";
import { EventEmitter } from "events";
import MFS from "memory-fs";


export interface RenderContext {
	title: string;
	meta: string;
	request: Context;
	shellOnly: boolean;
}

async function renderPage(ctx: Context, render: (ctx: RenderContext) => Promise<string>) {
	const context = {
		title: "Kaciras的博客",
		meta: "",
		shellOnly: ctx.query["shellOnly"],
		request: ctx,
	};
	try {
		ctx.body = await render(context);
	} catch (err) {
		switch (err.code) {
			case 301:
			case 302:
				ctx.status = err.code;
				ctx.redirect(err.location);
				break;
			default:
				ctx.throw(err);
		}
	}
}

/* Vue服务端渲染所需的几个参数 */
let serverBundle: any;
let template: string;
let clientManifest: any;

let renderFunction: (ctx: RenderContext) => Promise<string>;

/**
 * 读取并保存 VueSSRClientPlugin 输出的清单文件的 Webpack 插件
 */
class ClientManifestUpdatePlugin extends EventEmitter implements Plugin {

	readonly id = "ClientManifestUpdatePlugin";

	private readonly filename: string;

	constructor(filename: string = "vue-ssr-client-manifest.json") {
		super();
		this.filename = filename;
	}

	apply(compiler: Compiler): void {
		compiler.hooks.afterEmit.tap(this.id, compilation => {
			if (compilation.getStats().hasErrors()) return;
			const clientManifest = JSON.parse(compilation.assets[this.filename].source());
			this.emit("update", clientManifest);
		});
	}
}

// noinspection JSUnusedLocalSymbols
interface ClientManifestUpdatePlugin {
	on(event: "update", listener: (manifest: any) => void): this
}


export function configureWebpack(config: Configuration) {
	const plugin = new ClientManifestUpdatePlugin();
	plugin.on("update", manifest => {
		clientManifest = manifest;
		updateVueSSR();
	});
	if (!config.plugins) {
		config.plugins = []; // 我觉得不太可能一个插件都没有
	}
	config.plugins.push(plugin);
}

/**
 * 对服务端构建的监听，使用 wabpack.watch 来监视文件的变更，并输出到内存文件系统中，还会在每次
 * 构建完成后更新 serverBundle。
 *
 * @param options 配置
 */
export async function devMiddleware(options: any): Promise<Middleware> {
	const config: Configuration = require("../template/server.config").default(options.webpack);
	template = await fs.readFile(options.webpack.server.template, "utf-8");

	const compiler = webpack(config);
	compiler.outputFileSystem = new MFS(); // TODO: remove
	compiler.watch({}, (err, stats) => {
		if (err) throw err;
		if (stats.hasErrors()) return;

		serverBundle = JSON.parse(stats.compilation.assets["vue-ssr-server-bundle.json"].source());
		updateVueSSR();
	});

	return ctx => renderPage(ctx, renderFunction);
}

/**
 * 更新Vue的服务端渲染器，在客户端或服务端构建完成后调用。
 */
function updateVueSSR() {
	const render = createBundleRenderer(serverBundle, { template, clientManifest, runInNewContext: false });
	renderFunction = promisify(render.renderToString);
}

export async function prodMiddleware(options: any): Promise<Middleware> {

	function reslove(file: string) {
		return path.resolve(options.webpack.outputPath, file);
	}

	const renderer = createBundleRenderer(reslove("vue-ssr-server-bundle.json"), {
		runInNewContext: false,
		template: await fs.readFile(reslove("index.template.html"), { encoding: "utf-8" }),
		clientManifest: require(reslove("vue-ssr-client-manifest.json")),
	});

	const renderFunction = promisify<RenderContext, string>(renderer.renderToString);
	return ctx => renderPage(ctx, renderFunction);
}
