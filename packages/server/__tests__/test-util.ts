import path from "path";
import fs from "fs-extra";

export function resolveResource(name: string) {
	return path.join(__dirname, "resources", name);
}

export function readResourceText(name: string) {
	return fs.readFileSync(resolveResource(name), { encoding: "utf8" });
}
