import { EventEmitter } from "events";
import fs from "fs-extra";
import MFS from "memory-fs";
import { BundleRenderer, createBundleRenderer } from "vue-server-renderer";
import VueSSRClientPlugin from "vue-server-renderer/client-plugin";
import webpack, { Compiler, Configuration, Plugin } from "webpack";
import { WebpackOptions } from "../OldOptions";
import ServerConfiguration from "../template/server.config";
import { PromiseCompleteionSource } from "../utils";


/**
 * 读取并保存 VueSSRClientPlugin 输出的清单文件的 Webpack 插件。
 * 该插件需要被添加到客户端的构建配置里。
 */
class ClientManifestUpdatePlugin extends EventEmitter implements Plugin {

	readonly id = "ClientManifestUpdatePlugin";

	private readonly filename: string;
	private readonly readyPromiseSource: PromiseCompleteionSource<void>;

	constructor (filename: string = "vue-ssr-client-manifest.json") {
		super();
		this.filename = filename;
		this.readyPromiseSource = new PromiseCompleteionSource();
	}

	apply (compiler: Compiler): void {
		const plugins = compiler.options.plugins || [];

		if (!plugins.some((plugin) => plugin instanceof VueSSRClientPlugin)) {
			throw new Error("请将 vue-server-renderer/client-plugin 加入到客户端的构建中");
		}

		compiler.hooks.afterEmit.tap(this.id, (compilation) => {
			if (compilation.getStats().hasErrors()) {
				return;
			}
			this.readyPromiseSource.resolve();
			const source = compilation.assets[this.filename].source();
			this.emit("update", JSON.parse(source));
		});
	}

	get readyPromise (): PromiseLike<void> {
		return this.readyPromiseSource;
	}
}

interface ClientManifestUpdatePlugin {
	on (event: "update", listener: (manifest: any) => void): this;
}

/**
 * 提供Vue服务端渲染的热重载功能。
 * 该类需要调用 configureWebpackSSR 配置客户端构建，以便更新ClientManifest。
 * 该类将以监视模式构建服务端，在更新后重新构建渲染器。
 */
export default class VueSSRHotReloader {

	private clientPlugin?: ClientManifestUpdatePlugin;

	private serverBundle: any;
	private template: any;
	private clientManifest: any;

	private renderer?: BundleRenderer;

	configureWebpackSSR (config: Configuration) {
		this.clientPlugin = new ClientManifestUpdatePlugin();
		this.clientPlugin.on("update", (manifest) => {
			this.clientManifest = manifest;
			this.updateVueSSR();
		});
		if (!config.plugins) {
			config.plugins = []; // 我觉得不太可能一个插件都没有
		}
		config.plugins.push(this.clientPlugin);
	}

	/**
	 * 对服务端构建的监听，使用 wabpack.watch 来监视文件的变更，并输出到内存文件系统中，还会在每次
	 * 构建完成后更新 serverBundle。
	 *
	 * @param options 配置
	 */
	async rendererFactory (options: WebpackOptions) {
		if (!this.clientPlugin) {
			throw Error("请先将ClientManifestUpdatePlugin加入客户端webpack的配置中");
		}
		const config = ServerConfiguration(options);
		this.template = fs.readFileSync(options.server.template, "utf-8");

		const compiler = webpack(config);
		compiler.outputFileSystem = new MFS(); // TODO: remove

		const readyPromise = new PromiseCompleteionSource();
		compiler.watch({}, (err, stats) => {
			if (err) {
				throw err;
			}
			if (stats.hasErrors()) {
				return;
			}
			this.serverBundle = JSON.parse(stats.compilation.assets["vue-ssr-server-bundle.json"].source());
			this.updateVueSSR();
			readyPromise.resolve();
		});

		await Promise.all([readyPromise, this.clientPlugin.readyPromise]);
		console.log("Vue server side renderer created.");

		// assert this.renderer !== undefined
		return () => (this.renderer as BundleRenderer);
	}

	/**
	 * 更新Vue的服务端渲染器，在客户端或服务端构建完成后调用。
	 */
	updateVueSSR () {
		const { serverBundle, template, clientManifest } = this;
		this.renderer = createBundleRenderer(serverBundle, { template, clientManifest, runInNewContext: false });
	}
}
