import { EventEmitter } from "events";
import log4js from "log4js";
import MFS from "memory-fs";
import { BundleRenderer, createBundleRenderer } from "vue-server-renderer";
import VueSSRClientPlugin from "vue-server-renderer/client-plugin";
import webpack, { Compiler, Configuration, Plugin } from "webpack";
import { CliDevelopmentOptions } from "../options";
import ServerConfiguration from "../webpack/server.config";
import PromiseSource from "@kaciras-blog/common/lib/PromiseSource";


const logger = log4js.getLogger("dev");

/**
 * 读取并保存 VueSSRClientPlugin 输出的清单文件和HTML模板的插件。
 * 该插件需要被添加到客户端的构建配置里。
 */
class ClientSSRHotUpdatePlugin extends EventEmitter implements Plugin {

	static readonly ID = "ClientSSRHotUpdatePlugin";

	applied = false;

	private readonly manifestFile: string;
	private readonly templateFile: string;
	private readonly readyPromiseSource: PromiseSource<void>;

	constructor(manifestFile: string = "vue-ssr-client-manifest.json", templateFile: string = "index.template.html") {
		super();
		this.manifestFile = manifestFile;
		this.templateFile = templateFile;
		this.readyPromiseSource = new PromiseSource();
	}

	apply(compiler: Compiler): void {
		const plugins = compiler.options.plugins || [];
		this.applied = true;

		// noinspection SuspiciousTypeOfGuard 这是 Vue 内部的类型
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
 * 提供 Vue 服务端渲染的热重载功能。
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
	 * 对服务端构建的监听，使用 webpack.watch 来监视文件的变更，并输出到内存文件系统中，
	 * 在每次构建完成后会更新 serverBundle 以实现服务端构建的热重载。
	 */
	async getRendererFactory() {
		/*
		 * 检查 ClientSSRHotUpdatePlugin 是否被正确地加入客户端构建，因为该插件如过忘了添加
		 * 或是客户端的构建在此方法之后运行则会造成程序死锁。
		 * 但这么检查的话就不允许客户端构建异步启动，要完美解决可能得重新设计下API。
		 */
		if (!this.clientPlugin.applied) {
			throw new Error("ClientSSRHotUpdatePlugin未被应用，" +
				"请确保该插件加入到了客户端的构建配置，且客户端已开始构建");
		}

		const compiler = webpack(this.serverConfig);
		compiler.outputFileSystem = new MFS(); // TODO: 没必要保存到内存里

		const readyPromise = new PromiseSource();
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
