import Launcher from "@kaciras-blog/server/lib/Launcher";
import build from "./command/build";
import serve from "./command/serve";

const launcher = new Launcher();
export default launcher;

launcher.registerCommand("build", build);
launcher.registerCommand("serve", serve);
