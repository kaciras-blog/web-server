#!/usr/bin/env node
require("source-map-support").install();

const { argv } = require("node:process");
const Launcher = require("../lib/Launcher").default;

new Launcher().run(argv.slice(2));
