import { Configuration, Options } from "webpack";


/* =========================================================================== *\
								配置选项定义
\* =========================================================================== */

export interface WebpackOptions {
	mode: "development" | "production" | "none";

	outputPath: string;	// webpack的输出目录
	publicPath: string;	// 公共资源的URL前缀，可以设为外部服务器等
	assetsDirectory: string;	// 公共资源输出目录，是outputPath的子目录

	bundleAnalyzerReport: any;

	client: {
		useBabel: boolean,
		parallel: boolean, // 多线程编译JS文件
		devtool: Options.Devtool;
		cssSourceMap: boolean,
	};

	server: {
		template: string;
		devtool: Options.Devtool; // 服务端没有eval模式
		cssSourceMap: boolean,
	};

	vueLoader?: any;
}

type ConfigFactory = (api: DevelopmentApi) => Configuration;
type Configurer = (config: Configuration) => void;

export interface ConfigRegistration {
	build: boolean;
	factory: ConfigFactory;
}

interface ConfigMap {
	[name: string]: ConfigRegistration;
}

export class DevelopmentApi {

	private readonly registeredConfig: ConfigMap = {};
	private readonly configurer = new Map<string, Configurer[]>();

	private readonly cache = new Map<string, Configuration>();
	private readonly building = new Set<string>();

	addConfigurer (name: string, configurer: Configurer) {
		const list = this.configurer.get(name);
		if (list) {
			list.push(configurer);
		} else {
			this.configurer.set(name, [configurer]);
		}
	}

	addConfiguration (name: string, factory: ConfigFactory, build = false) {
		if (this.registeredConfig[name]) {
			throw new Error(`Webpack config: ${name} already registered`);
		}
		this.registeredConfig[name] = { factory, build };
	}

	resloveConfig (name: string): Configuration | undefined {
		const { registeredConfig, configurer, cache, building } = this;

		const registation = registeredConfig[name];
		if (!registation) {
			return undefined;
		}

		if (building.has(name)) {
			building.clear();
			throw new Error(`Cyclic refrence: ${name}`);
		}

		const cached = cache.get(name);
		if (cached) {
			return cached;
		}

		building.add(name);
		const config = registation.factory(this);
		cache.set(name, config);

		(configurer.get(name) || []).forEach((cx) => cx(config));

		building.delete(name);
		return config;
	}

	get toBuildConfigs () {
		return Object.entries(this.registeredConfig)
			.filter((value) => value[1].build)
			.map((value) => this.resloveConfig(value[0]));
	}
}

export interface DevelopmentApi {
	resloveConfig (name: "base"): Configuration;
}
