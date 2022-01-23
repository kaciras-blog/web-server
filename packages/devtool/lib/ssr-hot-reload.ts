import { EventEmitter } from "events";
import log4js from "log4js";
import { join } from "path";
import { Context } from "koa";
import webpack, { Compiler, Configuration, Watching } from "webpack";
import { renderPage } from "@kaciras-blog/server/lib/koa/vue-ssr";
import { readFileSync } from "fs-extra";

const logger = log4js.getLogger("dev");

/**
 * 读取并保存 VueSSRClientPlugin 输出的清单文件和HTML模板的插件。
 * 该插件需要手动添加到客户端的构建配置里。
 *
 * 当 ClientManifest 或HTML模板更新时将发出 update 事件，并传递对应的 Assets。
 */
export class ClientSSRHotUpdatePlugin extends EventEmitter {

	static readonly ID = "ClientSSRHotUpdatePlugin";

	private readonly manifestName: string;
	private readonly templateName: string;

	manifest: any;
	template: any;

	constructor(manifestName = "ssr-manifest.json", templateName = "index.template.html") {
		super();
		this.manifestName = manifestName;
		this.templateName = templateName;
	}

	apply(compiler: Compiler) {
		compiler.hooks.afterEmit.tap(ClientSSRHotUpdatePlugin.ID, (compilation) => {
			if (compilation.getStats().hasErrors()) {
				return;
			}
			this.emit("update");
		});
	}
}

export interface ClientSSRHotUpdatePlugin {
	on(event: "update", listener: (manifest: any, template: any) => void): this;
}

/**
 * 提供 Vue 服务端渲染的热重载功能。
 *
 * 服务端渲染器同时需要客户端构建的manifest、HTML模板，以及服务端构建的 serverBundle。
 *
 * @example
 * const reloader = new VueSSRHotReloader(clientConfig, serverConfig);
 * await reloader.watch();
 * app.use(reloader.koaMiddleware);
 */
export default class VueSSRHotReloader {

	private readonly clientConfig: Configuration;
	private readonly serverConfig: Configuration;
	private readonly bundleName: string;

	private template: any;
	private clientManifest: any;
	private serverBundle: any;

	private watching?: Watching;

	constructor(
		clientConfig: Configuration,
		serverConfig: Configuration,
		bundleName = "vue-ssr-server-bundle.json",
	) {
		this.clientConfig = clientConfig;
		this.serverConfig = serverConfig;
		this.bundleName = bundleName;
	}

	/**
	 * 获取服务端渲染的中间件，该中间件在webpack重新构建之后会自动重载新的资源。
	 *
	 * @return 中间件
	 */
	get koaMiddleware() {
		return (ctx: Context) => renderPage(this.template, this.serverBundle, this.clientManifest, ctx);
	}

	close(callback = () => {}) {
		if (!this.watching) {
			throw new Error("Not started yet.");
		}
		this.watching.close(callback);
	}

	/**
	 * 使用 webpack.watch 来监视文件的变更，并输出到内存文件系统中，
	 * 在每次构建完成后会更新 serverBundle 以实现服务端构建的热重载。
	 *
	 * @return 用于等待初始化完成的Promise
	 */
	watch() {
		return Promise.all([this.initClientCompiler(), this.initServerCompiler()]);
	}

	private initClientCompiler() {
		const clientPlugins = this.clientConfig.plugins || [];

		const plugin = clientPlugins.find((v) => v instanceof ClientSSRHotUpdatePlugin);
		if (!plugin) {
			throw new Error("请将ClientSSRHotUpdatePlugin加入到客户端构建配置里。");
		}
		const hotUpdatePlugin = plugin as ClientSSRHotUpdatePlugin;

		const updateClientResources = () => {
			const p = this.clientConfig.output!.path as string;

			// 新版 html-loader 在监视模式下不输出未变动的文件
			this.template = readFileSync(join(p, "index.template.html"), "utf8");
			this.clientManifest = require(join(p, "ssr-manifest.json"));
		};

		hotUpdatePlugin.on("update", updateClientResources);

		if (hotUpdatePlugin.manifest) {
			updateClientResources();
			return Promise.resolve();
		} else {
			return new Promise(resolve => hotUpdatePlugin.once("update", resolve));
		}
	}

	private initServerCompiler() {
		const compiler = webpack(this.serverConfig);

		const fn = join(this.serverConfig.output!.path, "server-bundle.js");

		return new Promise<void>(resolve => {
			this.watching = compiler.watch({}, (err, stats) => {
				if (err) {
					throw err;
				}
				if (stats!.hasErrors()) {
					logger.error(stats!.toString("errors-only"));
					logger.error("Server side build failed with errors.");
					return;
				}

				// const code = readFileSync(fn, "utf8");
				// const ctx = Object.create(global);
				// ctx.require = require;
				// ctx.module = { exports: {} };
				// runInNewContext(code, ctx);

				this.serverBundle = require(fn).default;
				resolve();
			});
		});
	}
}
