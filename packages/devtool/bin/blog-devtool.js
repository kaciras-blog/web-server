#!/usr/bin/env node
require("source-map-support").install();
const launcher = require("../lib/main").default;

launcher.run(process.argv.slice(2));
