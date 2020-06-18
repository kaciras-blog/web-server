import { Options } from "webpack";
import { VueLoaderOptions } from "vue-loader";
import { BlogServerOptions } from "@kaciras-blog/server/lib/options";

export interface DevelopmentOptions extends BlogServerOptions {
	dev: DevServerOptions;
	webpack: WebpackOptions;
	envConfig: EnvConfig;
}

export interface WebpackOptions {
	mode: "development" | "production" | "none";
	publicPath: string;
	parallel: boolean;

	bundleAnalyzerReport: any;

	speedMeasure?: boolean;

	client: {
		useBabel: boolean;
		devtool: Options.Devtool;
		cssSourceMap: boolean;
	};

	server: {
		devtool: Options.Devtool;
		cssSourceMap: boolean;
	};

	vueLoader?: VueLoaderOptions;
}

export interface DevServerOptions {
	useHotClient?: boolean;
}

export interface EnvConfig {
	REQUEST_TIMEOUT: number;
	SENTRY_DSN?: string;
	GOOGLE_ANALYTICS_ID?: string;
}
