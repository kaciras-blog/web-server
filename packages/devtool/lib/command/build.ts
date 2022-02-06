import { cyan } from "colorette";
import { build } from "vite";
import getViteConfig from "../build-config.js";
import { ResolvedDevConfig } from "../options";

// Vite 会删除输出目录，无需自己再清理。

export default async function (options: ResolvedDevConfig) {
	const conf1 = getViteConfig(options) as any;
	conf1.build.outDir = "dist/client";
	await build(conf1);
	console.log(cyan("Client Build complete."));

	const conf2 = getViteConfig(options) as any;
	conf2.build.ssr = "src/entry-server.ts";
	conf2.build.ssrManifest = true;
	conf2.build.outDir = "dist/server";
	await build(conf2);
	console.log(cyan("Server build complete."));
}
