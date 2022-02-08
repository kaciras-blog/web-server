import { cyan } from "colorette";
import { build } from "vite";
import getViteConfig from "../build-config.js";
import { ResolvedDevConfig } from "../options";

// Vite 会删除输出目录，无需自己再清理。

export default async function (options: ResolvedDevConfig) {
	await build(getViteConfig(options, false));
	console.log(cyan("Client Build complete."));

	await build(getViteConfig(options, true));
	console.log(cyan("Server build complete."));
}
