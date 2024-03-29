import { Options as VueOptions } from "@vitejs/plugin-vue";
import { BlogServerConfig, ResolvedConfig } from "@kaciras-blog/server";
import { PriorityArg } from "./manual-chunks.js";
import { ServiceWorkerOptions } from "./plugin/service-worker.js";

export interface DevelopmentOptions extends BlogServerConfig {
	build: BuildOptions;
}

export interface ResolvedDevConfig extends ResolvedConfig {
	build: BuildOptions;
}

export interface BuildOptions {
	mode?: string;
	sourcemap?: boolean | "inline" | "hidden";
	target?: string | string[];
	bundleAnalyzer?: boolean;
	debug?: boolean;
	serviceWorker?: ServiceWorkerOptions;
	vueOptions: VueOptions;
	chunkPriority?: PriorityArg;
}
