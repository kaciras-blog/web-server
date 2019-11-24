module.exports = {
	clearMocks: true,

	coverageDirectory: "coverage",
	collectCoverageFrom: [
		"packages/*/lib/**/*.ts",
		"!packages/*/lib/**/*.d.ts",
	],

	moduleFileExtensions: ["js", "json", "ts", "mjs"],
	preset: "ts-jest",
	testEnvironment: "node",

	testMatch: [
		"**/?(*.)+(spec|test).+(ts|tsx)",
		"**/__tests__/**/*-tests.+(ts|tsx)",
	],
};
