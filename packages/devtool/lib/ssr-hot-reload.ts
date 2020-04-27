import { EventEmitter } from "events";
import log4js from "log4js";
import MFS from "memory-fs";
import { Context } from "koa";
import { BundleRenderer, createBundleRenderer } from "vue-server-renderer";
import VueSSRClientPlugin from "vue-server-renderer/client-plugin";
import webpack, { Compiler, Configuration, Plugin, Watching } from "webpack";
import { renderPage } from "@kaciras-blog/server/lib/ssr-middleware";

const logger = log4js.getLogger("dev");

/**
 * 读取并保存 VueSSRClientPlugin 输出的清单文件和HTML模板的插件。
 * 该插件需要被添加到客户端的构建配置里。
 *
 * 当 ClientManifest 或HTML模板更新时将发出 update 事件，并传递对应的 Assets。
 */
export class ClientSSRHotUpdatePlugin extends EventEmitter implements Plugin {

	static readonly ID = "ClientSSRHotUpdatePlugin";

	private readonly manifestName: string;
	private readonly templateName: string;

	manifest: any;
	template: any;

	constructor(manifestName: string = "vue-ssr-client-manifest.json",
				templateName: string = "index.template.html") {
		super();
		this.manifestName = manifestName;
		this.templateName = templateName;
	}

	apply(compiler: Compiler): void {
		// noinspection SuspiciousTypeOfGuard 这是 Vue 内部的类型
		if (!(compiler.options.plugins || []).some((plugin) => plugin instanceof VueSSRClientPlugin)) {
			throw new Error("请将 vue-server-renderer/client-plugin 加入到客户端的构建中");
		}

		compiler.hooks.afterEmit.tap(ClientSSRHotUpdatePlugin.ID, (compilation) => {
			if (compilation.getStats().hasErrors()) {
				return;
			}
			this.manifest = compilation.assets[this.manifestName];
			this.template = compilation.assets[this.templateName];
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
 * 该类需要调用 configureWebpackSSR 配置客户端构建，以便更新ClientManifest。
 * 该类将以监视模式构建服务端，在更新后重新构建渲染器。
 */
export default class VueSSRHotReloader {

	private readonly clientConfig: Configuration;
	private readonly serverConfig: Configuration;

	private template: any;
	private clientManifest: any;
	private serverBundle: any;

	private renderer!: BundleRenderer;

	private watching?: Watching;

	constructor(clientConfig: Configuration, serverConfig: Configuration) {
		this.clientConfig = clientConfig;
		this.serverConfig = serverConfig;
	}

	/**
	 * 获取服务端渲染的中间件，该中间件在webpack重新构建之后会自动重载新的资源。
	 *
	 * @return 中间件
	 */
	get koaMiddleware() {
		return (ctx: Context) => renderPage(this.renderer, ctx);
	}

	close(callback = () => {}) {
		if (!this.watching) {
			throw new Error("Not started yet.")
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
			throw new Error("请将ClientSSRHotUpdatePlugin加入到客户端构建配置里。")
		}
		const hotUpdatePlugin = plugin as ClientSSRHotUpdatePlugin;

		const updateClientResources = () => {
			const { template, manifest } = hotUpdatePlugin;

			// 新版 html-loader 在监视模式下不输出未变动的文件
			if (template) {
				this.template = template.source();
			}
			this.clientManifest = JSON.parse(manifest.source());
			this.updateVueSSR();
		}

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
		compiler.outputFileSystem = new MFS(); // TODO: 没必要保存到内存里

		return new Promise(resolve => {
			this.watching = compiler.watch({}, (err, stats) => {
				if (err) {
					throw err;
				}
				if (stats.hasErrors()) {
					return logger.error(stats.toString());
				}
				resolve();
				this.serverBundle = JSON.parse(stats.compilation.assets["vue-ssr-server-bundle.json"].source());
				this.updateVueSSR();
			});
		})
	}

	/**
	 * 更新Vue的服务端渲染器，在客户端或服务端构建完成后调用。
	 */
	private updateVueSSR() {
		const { serverBundle, template, clientManifest } = this;
		this.renderer = createBundleRenderer(serverBundle, { template, clientManifest, runInNewContext: false });
	}
}
