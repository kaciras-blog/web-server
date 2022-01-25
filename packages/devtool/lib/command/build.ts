import getViteConfig from "../build-config.js";
import { build } from "vite";
import { cyan } from "colorette";
import fs from "fs-extra";
import { ResolvedDevConfig } from "../options";

export default async function (options: ResolvedDevConfig) {
	await fs.remove(options.outputDir);

	const conf1 = getViteConfig(options) as any;
	conf1.build.outDir = "dist/client";
	await build(conf1);
	console.log(cyan("Client Build complete."));

	const conf2 = getViteConfig(options) as any;
	conf2.build.ssr = "src/entry-server.ts";
	conf2.build.outDir = "dist/server";
	await build(conf2);
	console.log(cyan("Server build complete."));
}
