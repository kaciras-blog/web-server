import { BlogServerConfig, ResolvedConfig } from "@kaciras-blog/server/lib/config";

export interface DevelopmentOptions extends BlogServerConfig {
	dev: DevServerOptions;
	build: BuildOptions;
	thirdParty: ThirdPartyOptions;
}

export interface ResolvedDevConfig extends ResolvedConfig {
	dev: DevServerOptions;
	build: BuildOptions;
	thirdParty: ThirdPartyOptions;
}

export interface BuildOptions {
	mode: boolean;
	bundleAnalyzer: boolean;
}

export interface DevServerOptions {
	useHotClient?: boolean;
}

export interface ThirdPartyOptions {
	SENTRY_DSN?: string;
	GOOGLE_ANALYTICS_ID?: string;
}
