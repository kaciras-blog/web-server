import Launcher from "../lib/Launcher";

require("source-map-support").install();
new Launcher().run(process.argv.slice(2));
