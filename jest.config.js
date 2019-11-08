module.exports = {
	clearMocks: true, // Automatically clear mock calls and instances between every test
	coverageDirectory: "coverage", // The directory where Jest should output its coverage files

	moduleFileExtensions: ["js", "json", "jsx", "ts", "mjs"],
	preset: "ts-jest",
	testEnvironment: "node",

	testMatch: [
		"**/?(*.)+(spec|test).+(ts|tsx)",
		"**/__tests__/**/*-tests.+(ts|tsx)",
	],
};
