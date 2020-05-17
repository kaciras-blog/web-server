module.exports = {
	root: true,
	plugins: ["jest", "@typescript-eslint"],
	env: {
		es2020: true,
		node: true,
	},
	extends: [
		"eslint:recommended",
	],
	rules: {
		"quotes": ["error", "double", {
			avoidEscape: true,
		}],
		"no-var-requires": "off",
		"no-unused-vars": "off",
		"require-atomic-updates": "off",
		"eqeqeq": "error",
		"comma-dangle": ["error", "always-multiline"],
	},
	overrides: [
		{
			files: ["**/__tests__/*.spec.{j,t}s?(x)",],
			env: { jest: true },
			extends: [
				"plugin:jest/style",
				"plugin:jest/recommended",
			],
			rules: {
				"jest/expect-expect": "off",
				"jest/no-test-callback": "off",
			},
		},
		{
			files: ["*.ts", "*.tsx"],
			parser: "@typescript-eslint/parser",
			extends: [
				"plugin:@typescript-eslint/eslint-recommended",
				"plugin:@typescript-eslint/recommended",
			],
			rules: {
				"@typescript-eslint/ban-ts-ignore": "off",
				"@typescript-eslint/no-unused-vars": "off",
				"@typescript-eslint/no-empty-function": "off",
				"@typescript-eslint/explicit-function-return-type": "off",
				"@typescript-eslint/no-explicit-any": "off",
				"@typescript-eslint/no-non-null-assertion": "off",
				"@typescript-eslint/no-use-before-define": "off",
			},
		},
	],
};
