const jestConfig = require("./jest.config");

module.exports = {
	root: true,
	extends: [
		"@kaciras/core",
		"@kaciras/typescript",
	],
	env: {
		node: true,
	},
	overrides: [
		{
			files: jestConfig.testMatch,
			extends: [
				"plugin:jest/style",
				"plugin:jest/recommended",
			],
			rules: {
				"jest/expect-expect": "off",
				"jest/no-done-callback": "off",
			},
		},
	],
};
