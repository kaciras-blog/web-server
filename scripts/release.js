const execa = require("execa");
const fs = require("fs-extra");
const chalk = require("chalk");


async function pack (name) {
	const version = require(`../packages/${name}/package.json`).version;
	await execa("yarn", ["workspace", name, "pack"]);

	const packname = `${name}-v${version}.tgz`;
	await fs.rename(`packages/${name}/${packname}`, `dist/${packname}`);

	console.log(`Build package: ${packname}`);
}

async function release () {
	await fs.mkdirs("dist");
	const packages = await fs.readdir("packages");

	for (const p of packages) {
		await pack(p);
	}
	console.log(chalk.blue("\nPack complete."));
}

// lerna version --no-git-tag-version  --no-push --yes
release().catch((err) => console.error(err));
