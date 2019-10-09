import { Options } from "webpack";
import { VueLoaderOptions } from "vue-loader";
import { CliServerOptions } from "@kaciras-blog/server/lib/options";


export interface CliDevelopmentOptions extends CliServerOptions {
	dev: DevServerOptions;
	webpack: WebpackOptions;
	envConfig: EnvConfig;
}

export interface WebpackOptions {
	mode: "development" | "production" | "none";
	publicPath: string;
	parallel: boolean;
	bundleAnalyzerReport: any;

	client: {
		useBabel: boolean,
		devtool: Options.Devtool;
		cssSourceMap: boolean,
	};

	server: {
		devtool: Options.Devtool;
		cssSourceMap: boolean,
	};

	vueLoader?: VueLoaderOptions;
}

export interface DevServerOptions {
	silent: boolean;
	useHotClient?: boolean;
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
