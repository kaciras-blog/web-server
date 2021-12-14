module.exports = {
	testMatch: [
		"**/?(*.)+(spec|test).ts",
	],
	moduleFileExtensions: [
		"ts", "js", "mjs", "json",
	],
	transform: {
		"^.+\\.ts$": ["@swc/jest"],
	},
	clearMocks: true,
	collectCoverageFrom: [
		"packages/*/lib/**/*.ts",
	],
	coverageDirectory: "coverage",
};
