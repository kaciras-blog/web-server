import { Options as VueOptions } from "@vitejs/plugin-vue";
import { BlogServerConfig, ResolvedConfig } from "@kaciras-blog/server/lib/config";
import { ServiceWorkerOptions } from "./plugin/service-worker";

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
	mode: string;
	bundleAnalyzer: boolean;
	serviceWorker?: ServiceWorkerOptions;
	vueOptions: VueOptions;
}

export interface DevServerOptions {
	useHotClient?: boolean;
}

export interface ThirdPartyOptions {
	SENTRY_DSN?: string;
	GOOGLE_ANALYTICS_ID?: string;
}
