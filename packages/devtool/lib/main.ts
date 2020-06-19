import Launcher from "@kaciras-blog/server/lib/Launcher";
import { DevelopmentOptions } from "./options";

const launcher = new Launcher<DevelopmentOptions>();
export default launcher;

launcher.registerCommand("serve", require("./command/serve"));
launcher.registerCommand("build", require("./command/build"));
