module.exports = {
	clearMocks: true, // Automatically clear mock calls and instances between every test
	coverageDirectory: "coverage", // The directory where Jest should output its coverage files

	moduleFileExtensions: ["js", "json", "jsx", "ts", "mjs"],
	testEnvironment: "node",
	testMatch: [
		"**/test/**/*.js?(x)",
		"**/?(*.)+(spec|test).js?(x)",
	],
};
