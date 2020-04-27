import launcher from "../lib/main";

require("source-map-support").install();
launcher.run(process.argv.slice(2));
