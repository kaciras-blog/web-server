/// <reference types="vite/client" />

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

// Vue 没有像 React 一样提供 SVG 元素的 props 类型。
declare module "*.svg?sfc" {
	import { DefineComponent } from "vue";

	// eslint-disable-next-line @typescript-eslint/ban-types
	const component: DefineComponent<{}, {}, any>;

	export default component;
}
