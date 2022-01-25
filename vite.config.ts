/// <reference types="vitest" />
import { defineConfig } from "vite";

export default defineConfig({
	test: {
		/* for example, use global to avoid globals imports (describe, test, expect): */
		// globals: true,

		// execa 在 worker 中调用了 process.chdir 会报错。
		threads: false,
		isolate: false,

		clearMocks: true,
		// include: ["packages/media/__tests__/**/*.spec.ts"],
		include: ["packages/devtool/__tests__/process-image.spec.ts"],
	},
});
