/// <reference types="vitest" />
import { defineConfig } from "vite";

export default defineConfig({
	test: {
		/* for example, use global to avoid globals imports (describe, test, expect): */
		// globals: true,

		clearMocks: true,

		// include: ["packages/*/__tests__/**/*.spec.ts"],
		include: ["packages/markdown/__tests__/**/media.spec.ts"],
	},
});
