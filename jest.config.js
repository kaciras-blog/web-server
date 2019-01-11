const path = require("path");

module.exports = {
	clearMocks: true, // Automatically clear mock calls and instances between every test
	coverageDirectory: "coverage", // The directory where Jest should output its coverage files

	moduleFileExtensions: ["js", "json", "jsx", "ts", "mjs"],
	testEnvironment: "node",
	testMatch: [
		"**/__tests__/**/*.+(ts|tsx)",
		"**/?(*.)+(spec|test).+(ts|tsx)",
	],
	transform: {
		"^.+\\.(ts|tsx)$": "ts-jest",
	},
	globals: {
		"ts-jest": {
			"tsConfig": path.join(__dirname, "tsconfig.json"),
		},
	},
	preset: "ts-jest",
};
