import { EventEmitter } from "events";
import MFS from "memory-fs";
import { BundleRenderer, createBundleRenderer } from "vue-server-renderer";
import VueSSRClientPlugin from "vue-server-renderer/client-plugin";
import webpack, { Compiler, Configuration, Plugin } from "webpack";
import { CliDevelopmentOptions } from "..";
import ServerConfiguration from "../webpack/server.config";
import { PromiseCompletionSource } from "../utils";
import log4js from "log4js";


const logger = log4js.getLogger("dev");

/**
 * 读取并保存 VueSSRClientPlugin 输出的清单文件和HTML模板的插件。
 * 该插件需要被添加到客户端的构建配置里。
 */
class ClientSSRHotUpdatePlugin extends EventEmitter implements Plugin {

	static readonly ID = "ClientSSRHotUpdatePlugin";

	private readonly manifestFile: string;
	private readonly templateFile: string;
	private readonly readyPromiseSource: PromiseCompletionSource<void>;

	constructor(manifestFile: string = "vue-ssr-client-manifest.json", templateFile: string = "index.template.html") {
		super();
		this.manifestFile = manifestFile;
		this.templateFile = templateFile;
		this.readyPromiseSource = new PromiseCompletionSource();
	}

	apply(compiler: Compiler): void {
		const plugins = compiler.options.plugins || [];

		// noinspection SuspiciousTypeOfGuard 这是Vue自己的类型定义没写
		if (!plugins.some((plugin) => plugin instanceof VueSSRClientPlugin)) {
			throw new Error("请将 vue-server-renderer/client-plugin 加入到客户端的构建中");
		}

		compiler.hooks.afterEmit.tap(ClientSSRHotUpdatePlugin.ID, (compilation) => {
			if (compilation.getStats().hasErrors()) {
				return;
			}
			this.readyPromiseSource.resolve();
			const source = compilation.assets[this.manifestFile].source();
			const template = compilation.assets[this.templateFile].source();
			this.emit("update", JSON.parse(source), template);
		});
	}

	get readyPromise(): PromiseLike<void> {
		return this.readyPromiseSource;
	}
}

interface ClientSSRHotUpdatePlugin {
	on(event: "update", listener: (manifest: any, template: any) => void): this;
}

/**
 * 提供Vue服务端渲染的热重载功能。
 *
 * 该类需要调用 configureWebpackSSR 配置客户端构建，以便更新ClientManifest。
 * 该类将以监视模式构建服务端，在更新后重新构建渲染器。
 */
export default class VueSSRHotReloader {

	public static create(clientConfig: Configuration, options: CliDevelopmentOptions) {
		const plugin = new ClientSSRHotUpdatePlugin();
		if (!clientConfig.plugins) {
			clientConfig.plugins = []; // 我觉得不太可能一个插件都没有
		}
		clientConfig.plugins.push(plugin);

		const serverConfig = ServerConfiguration(options);
		return new VueSSRHotReloader(plugin, serverConfig);
	}

	private readonly clientPlugin: ClientSSRHotUpdatePlugin;
	private readonly serverConfig: Configuration;

	private template: any;
	private clientManifest: any;
	private serverBundle: any;

	private renderer!: BundleRenderer;

	constructor(clientPlugin: ClientSSRHotUpdatePlugin, serverConfig: Configuration) {
		clientPlugin.on("update", (manifest, template) => {
			this.template = template;
			this.clientManifest = manifest;
			this.updateVueSSR();
		});
		this.clientPlugin = clientPlugin;
		this.serverConfig = serverConfig;
	}

	/**
	 * 对服务端构建的监听，使用 webpack.watch 来监视文件的变更，并输出到内存文件系统中，还会在每次
	 * 构建完成后更新 serverBundle。
	 */
	async getRendererFactory() {
		const compiler = webpack(this.serverConfig);
		compiler.outputFileSystem = new MFS(); // TODO: 没必要保存到内存里

		const readyPromise = new PromiseCompletionSource();
		compiler.watch({}, (err, stats) => {
			if (err) {
				throw err;
			}
			if (stats.hasErrors()) {
				return logger.error(stats.toString());
			}
			this.serverBundle = JSON.parse(stats.compilation.assets["vue-ssr-server-bundle.json"].source());
			this.updateVueSSR();
			readyPromise.resolve();
		});

		await Promise.all([readyPromise, this.clientPlugin.readyPromise]);

		logger.info("Vue server side renderer created.");
		return () => this.renderer;
	}

	/**
	 * 更新Vue的服务端渲染器，在客户端或服务端构建完成后调用。
	 */
	private updateVueSSR() {
		const { serverBundle, template, clientManifest } = this;
		this.renderer = createBundleRenderer(serverBundle, { template, clientManifest, runInNewContext: false });
	}
}
