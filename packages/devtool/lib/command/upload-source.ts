import { readFileSync } from "fs";
import { cwd } from "process";
import { join } from "path";
import SentryCli from "@sentry/cli";
import { ResolvedDevConfig } from "../options";
import getViteConfig from "../build-config.js";

export default async function (options: ResolvedDevConfig) {
	const { authToken, org, project } = options.sentry;
	if (!authToken) {
		throw new Error("需要填写 SENTRY_TOKEN 环境变量。");
	}

	// @ts-ignore JSON.parse 支持 Buffer 类型。
	const { name, version } = JSON.parse(readFileSync(join(cwd(), "package.json")));
	const { build } = getViteConfig(options, true, false);

	const cli = new SentryCli(null, {
		authToken,
		org: org,
		project: project,
		// url: sentryOptions.url,
	});

	const release = `${name.replace("/", ".")}@${version}`;
	await cli.releases.new(release);
	await cli.releases.uploadSourceMaps(release, { include: [build!.outDir!] });
}
