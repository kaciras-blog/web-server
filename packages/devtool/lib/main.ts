import Launcher from "@kaciras-blog/server/lib/Launcher";
import { DevelopmentOptions } from "./options";
import build from "./command/build";
import serve from "./command/serve";

const launcher = new Launcher<DevelopmentOptions>();
export default launcher;

launcher.registerCommand("build", build);
launcher.registerCommand("serve", serve);
