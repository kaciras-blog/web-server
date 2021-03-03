#!/usr/bin/env node
const Launcher = require("../lib/Launcher").default;

new Launcher().run(process.argv.slice(2));
