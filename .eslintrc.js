module.exports = {
	root: true,
	plugins: ["jest"],
	env: {
		node: true,
	},
	extends: [
		"@kaciras/core",
		"@kaciras/typescript",
	],
	rules: {
		"@typescript-eslint/no-var-requires": "off",
		"@typescript-eslint/no-unused-vars": "off",
	},
	overrides: [
		{
			files: ["**/__tests__/*.spec.{j,t}s?(x)"],
			env: {
				jest: true,
			},
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
