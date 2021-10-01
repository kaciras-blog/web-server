import { VueLoaderOptions } from "vue-loader";
import { BlogServerOptions } from "@kaciras-blog/server/lib/options";

export interface DevelopmentOptions extends BlogServerOptions {
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
