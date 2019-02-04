"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const execa_1 = __importDefault(require("execa"));
const fs_1 = require("fs");
const chalk_1 = __importDefault(require("chalk"));
async function pack(name) {
    const version = require(`../packages/${name}/package.json`).version;
    await execa_1.default("yarn", ["workspace", name, "pack"]);
    const packname = `${name}-v${version}.tgz`;
    await fs_1.promises.rename(`packages/${name}/${packname}`, `dist/${packname}`);
    console.log(`\nBuild package: ${packname}`);
}
async function release() {
    const packages = await fs_1.promises.readdir("packages");
    for (const p of packages) {
        await pack(p);
    }
    console.log(chalk_1.default.cyan("Pack complete."));
}
release().catch((err) => console.error(err));
//# sourceMappingURL=release.js.map