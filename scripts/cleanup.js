const fs = require("fs-extra");
const chalk = require("chalk");
const globby = require("globby") ;


async function cleanup () {
	const files = await globby(["packages/**/*.{js,map,d.ts}", "!packages/**/__mocks__"]);
	for (const file of files) {
		console.log(`Remove: ${file}`);
		await fs.remove(file);
	}
	console.log(chalk.blue("\nCleanup complete."));
}

cleanup().catch((err) => console.error(err));
