/// <reference types="vite/client" />
/// <reference types="vite-plugin-svg-sfc/client" />

interface ImportMetaEnv {
	readonly API_PUBLIC: string;
	readonly API_INTERNAL: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}

declare module "*.vue" {
	import { DefineComponent } from "vue";

	// eslint-disable-next-line @typescript-eslint/ban-types
	const component: DefineComponent<{}, {}, any>;

	export default component;
}
