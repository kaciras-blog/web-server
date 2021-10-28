#!/usr/bin/env node
require("source-map-support").install();

const { argv } = require("node:process");
const launcher = require("../lib/main").default;

launcher.run(argv.slice(2));
