import { Options } from "webpack";
import { VueLoaderOptions } from "vue-loader";
import { CliServerOptions } from "@kaciras-blog/server/options";


export interface CliDevelopmentOptions extends CliServerOptions {
	dev: DevServerOptions;
	webpack: WebpackOptions;
	envConfig: EnvConfig;
}

export interface WebpackOptions {
	mode: "development" | "production" | "none";
	publicPath: string; // 公共资源的URL前缀，可以设为外部服务器等
	parallel: boolean; // 多线程编译JS文件
	bundleAnalyzerReport: any;

	client: {
		useBabel: boolean,
		devtool: Options.Devtool;
		cssSourceMap: boolean,
	};

	server: {
		devtool: Options.Devtool; // 服务端没有eval模式
		cssSourceMap: boolean,
	};

	vueLoader?: VueLoaderOptions;
}

export interface DevServerOptions {
	silent: boolean;
	useHotClient: boolean;
}

export interface EnvConfig {
	contentServerUri: string | {
		http: string;
		https: string;
	};
	webHost?: string;
	sentryDSN?: string;
	googleTagManager?: string;
}
