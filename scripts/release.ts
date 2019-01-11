import execa from "execa";
import { promises as fs } from "fs";
import chalk from "chalk";


async function pack (name: string) {
	const version = require(`../packages/${name}/package.json`).version;
	await execa("yarn", ["workspace", name, "pack"]);

	const packname = `${name}-v${version}.tgz`;
	await fs.rename(`packages/${name}/${packname}`, `dist/${packname}`);

	console.log(`\nBuild package: ${packname}`);
}

async function release () {
	const packages = await fs.readdir("packages");
	for (const p of packages) {
		await pack(p);
	}
	console.log(chalk.cyan("Pack complete."));
}

release().catch((err) => console.error(err));
