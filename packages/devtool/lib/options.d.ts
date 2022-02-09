import { Options as VueOptions } from "@vitejs/plugin-vue";
import { BlogServerConfig, ResolvedConfig } from "@kaciras-blog/server";
import { ServiceWorkerOptions } from "./plugin/service-worker";

export interface DevelopmentOptions extends BlogServerConfig {
	build: BuildOptions;
}

export interface ResolvedDevConfig extends ResolvedConfig {
	build: BuildOptions;
}

export interface BuildOptions {
	mode: string;
	target?: string | string[];
	env?: Record<string, any>;
	bundleAnalyzer?: boolean;
	debug?: boolean;
	serviceWorker?: ServiceWorkerOptions;
	vueOptions: VueOptions;
}
