import { Launcher } from "@kaciras-blog/server";
import build from "./command/build.js";
import serve from "./command/serve.js";

const launcher = new Launcher();
export default launcher;

launcher.registerCommand("build", build);
launcher.registerCommand("serve", serve);
