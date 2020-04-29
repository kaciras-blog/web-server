#!/usr/bin/env node
require("source-map-support").install();
const Launcher = require("../lib/Launcher").default;

new Launcher().run(process.argv.slice(2));
