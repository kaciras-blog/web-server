module.exports = {
	testMatch: [
		"**/?(*.)+(spec|test).ts",
	],
	moduleFileExtensions: [
		"ts", "js", "mjs", "json",
	],
	preset: "ts-jest",
	clearMocks: true,
	collectCoverageFrom: [
		"packages/*/lib/**/*.ts",
	],
	coverageDirectory: "coverage",
};
