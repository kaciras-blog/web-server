const { dirname } = require("path");
const fs = require("fs-extra");
const chalk = require("chalk");
const globby = require("globby");

/** 删除所有自动生成的文件 */
async function cleanup() {
	const files = await globby([
		"packages/**/*.{js,map}",
		"!packages/*/bin/*.js",
		"!**/node_modules/**",
		"!**/__mocks__",
		"!**/__tests__/fixtures",
	]);

	for (const file of files) {
		await fs.remove(file);
		console.log(`Remove ${file}`);
	}

	console.log(chalk.blue("\nCleanup complete."));
}

process.chdir(dirname(__dirname));
cleanup().catch((err) => console.error(err));
