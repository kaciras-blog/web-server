/// <reference types="vitest" />
import { defineConfig } from "vite";

export default defineConfig({
	test: {
		clearMocks: true,

		coverage: {
			reporter: ["lcov"],
			provider: "v8",
		},

		include: ["packages/*/__tests__/**/*.spec.ts"],
	},
});
