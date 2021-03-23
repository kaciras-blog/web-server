module.exports = {
	root: true,
	extends: [
		"@kaciras/core",
		"@kaciras/typescript",
	],
	env: {
		node: true,
	},
	plugins: [
		"jest",
	],
	rules: {
		"@typescript-eslint/no-var-requires": "off",
		"@typescript-eslint/no-unused-vars": "off",
	},
	overrides: [
		{
			files: ["**/__tests__/*.spec.{j,t}s"],
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
