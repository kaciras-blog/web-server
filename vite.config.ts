/// <reference types="vitest" />
import { defineConfig } from "vite";

export default defineConfig({
	test: {
		clearMocks: true,

		// 多线程目前有很多 Bug。
		threads: false,
		isolate: false,

		coverage: {
			reporter: ["lcov"],
		},

		include: ["packages/*/__tests__/**/*.spec.ts"],
	},
});
