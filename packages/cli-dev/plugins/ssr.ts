import { EventEmitter } from "events";
import fs from "fs-extra";
import MFS from "memory-fs";
import { BundleRenderer, createBundleRenderer } from "vue-server-renderer";
import webpack, { Compiler, Configuration, Plugin } from "webpack";


/* Vue服务端渲染所需的几个参数 */
let serverBundle: any;
let template: string;
let clientManifest: any;

let renderer: BundleRenderer;

/**
 * 读取并保存 VueSSRClientPlugin 输出的清单文件的 Webpack 插件
 */
class ClientManifestUpdatePlugin extends EventEmitter implements Plugin {

	readonly id = "ClientManifestUpdatePlugin";

	private readonly filename: string;

	constructor (filename: string = "vue-ssr-client-manifest.json") {
		super();
		this.filename = filename;
	}

	apply (compiler: Compiler): void {
		compiler.hooks.afterEmit.tap(this.id, (compilation) => {
			if (compilation.getStats().hasErrors()) { return; }
			const source = compilation.assets[this.filename].source();
			this.emit("update", JSON.parse(source));
		});
	}
}

// noinspection JSUnusedLocalSymbols
interface ClientManifestUpdatePlugin {
	on (event: "update", listener: (manifest: any) => void): this;
}

export function configureWebpack (config: Configuration) {
	const plugin = new ClientManifestUpdatePlugin();
	plugin.on("update", (manifest) => {
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
export async function rendererFactory (options: any): Promise<() => BundleRenderer> {
	const config: Configuration = require("../template/server.config").default(options.webpack);
	template = await fs.readFile(options.webpack.server.template, "utf-8");

	const compiler = webpack(config);
	compiler.outputFileSystem = new MFS(); // TODO: remove
	compiler.watch({}, (err, stats) => {
		if (err) { throw err; }
		if (stats.hasErrors()) { return; }

		serverBundle = JSON.parse(stats.compilation.assets["vue-ssr-server-bundle.json"].source());
		updateVueSSR();
	});

	return () => renderer;
}

/**
 * 更新Vue的服务端渲染器，在客户端或服务端构建完成后调用。
 */
function updateVueSSR () {
	renderer = createBundleRenderer(serverBundle, { template, clientManifest, runInNewContext: false });
}
