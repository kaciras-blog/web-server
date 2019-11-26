module.exports = {
	clearMocks: true,

	coverageDirectory: "coverage",
	collectCoverageFrom: [
		"packages/*/lib/**/*.ts",
		"!packages/*/lib/**/*.d.ts",
	],

	// 可倒入文件的扩展名，在前面的将优先匹配。
	// 使用 TypeScript 时必须把 ts 放在 js 前面，否则它会使用生成的 js 文件而不是源文件。
	// https://jestjs.io/docs/en/configuration#modulefileextensions-arraystring
	moduleFileExtensions: ["ts", "js", "mjs", "json"],

	preset: "ts-jest",
	testEnvironment: "node",

	testMatch: [
		"**/?(*.)+(spec|test).+ts",
		"**/__tests__/**/*-tests.+ts",
	],
};
