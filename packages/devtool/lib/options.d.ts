import { VueLoaderOptions } from "vue-loader";
import { BlogServerConfig, ResolvedConfig } from "@kaciras-blog/server/lib/config";

export interface DevelopmentOptions extends BlogServerConfig {
	dev: DevServerOptions;
	webpack: WebpackOptions;
	thirdParty: ThirdPartyOptions;
}

export interface ResolvedDevConfig extends ResolvedConfig {
	dev: DevServerOptions;
	webpack: WebpackOptions;
	thirdParty: ThirdPartyOptions;
}

export interface WebpackOptions {
	mode: "development" | "production" | "none";
	publicPath: string;
	parallel: boolean;

	bundleAnalyzerReport: any;

	speedMeasure?: boolean;

	client: {
		devtool: string | false;
		cssSourceMap: boolean;
	};

	server: {
		devtool: string | false;
		cssSourceMap: boolean;
	};

	vueLoader?: VueLoaderOptions;
}

export interface DevServerOptions {
	useHotClient?: boolean;
}

export interface ThirdPartyOptions {
	SENTRY_DSN?: string;
	GOOGLE_ANALYTICS_ID?: string;
}
