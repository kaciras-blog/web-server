import { Launcher } from "@kaciras-blog/server";
import build from "./command/build.js";
import serve from "./command/serve.js";
import uploadSource from "./command/upload-source.js";

const launcher = new Launcher();
export default launcher;

launcher.registerCommand("build", build);
launcher.registerCommand("serve", serve);
launcher.registerCommand("upload-source", uploadSource);
