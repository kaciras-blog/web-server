import { EventEmitter } from "events";
import fs from "fs-extra";
import MFS from "memory-fs";
import { BundleRenderer, createBundleRenderer } from "vue-server-renderer";
import VueSSRClientPlugin from "vue-server-renderer/client-plugin";
import webpack, { Compiler, Configuration, Plugin } from "webpack";
import { CliDevelopmentPlugin } from "../Boot";
import { DevelopmentApi } from "../index";
import ServerConfiguration from "../template/server.config";

class PromiseCompleteionSource<T> {

	promise: Promise<T>;
	reslove!: (value?: T | PromiseLike<T>) => void;
	reject!: (reason?: any) => void;

	constructor () {
		this.promise = new Promise((reslove, reject) => {
			this.reject = reject;
			this.reslove = reslove;
		});
	}
}

// ============================ Server Side Rendering ============================

/* Vue服务端渲染所需的几个参数 */
let serverBundle: any;
let template: string;
let clientManifest: any;

let renderer: BundleRenderer;

let clientPlugin: ClientManifestUpdatePlugin;

/**
 * 读取并保存 VueSSRClientPlugin 输出的清单文件的 Webpack 插件
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
			this.readyPromiseSource.reslove();
			const source = compilation.assets[this.filename].source();
			this.emit("update", JSON.parse(source));
		});
	}

	get readyPromise () {
		return this.readyPromiseSource.promise;
	}
}

// noinspection JSUnusedLocalSymbols
interface ClientManifestUpdatePlugin {
	on (event: "update", listener: (manifest: any) => void): this;
}

export function configureWebpackSSR (config: Configuration) {
	clientPlugin = new ClientManifestUpdatePlugin();
	clientPlugin.on("update", (manifest) => {
		clientManifest = manifest;
		updateVueSSR();
	});
	if (!config.plugins) {
		config.plugins = []; // 我觉得不太可能一个插件都没有
	}
	config.plugins.push(clientPlugin);
}

/**
 * 对服务端构建的监听，使用 wabpack.watch 来监视文件的变更，并输出到内存文件系统中，还会在每次
 * 构建完成后更新 serverBundle。
 *
 * @param options 配置
 */
export async function rendererFactory (options: any) {
	if (!clientPlugin) {
		throw Error("请先将ClientManifestUpdatePlugin加入客户端webpack的配置中");
	}
	const config = ServerConfiguration(options);
	template = fs.readFileSync(options.server.template, "utf-8");

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
		readyPromise.reslove();
		serverBundle = JSON.parse(stats.compilation.assets["vue-ssr-server-bundle.json"].source());
		updateVueSSR();
	});

	await Promise.all([readyPromise.promise, clientPlugin.readyPromise]);
	console.log("Vue server side renderer created.");

	return () => renderer;
}

/**
 * 更新Vue的服务端渲染器，在客户端或服务端构建完成后调用。
 */
function updateVueSSR () {
	renderer = createBundleRenderer(serverBundle, { template, clientManifest, runInNewContext: false });
}

export default class VueSSRDevelopmentPlugin implements CliDevelopmentPlugin {
	applyWebpack (api: DevelopmentApi): void {
	}
}
