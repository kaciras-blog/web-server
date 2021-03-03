#!/usr/bin/env node
const launcher = require("../lib/main").default;

launcher.run(process.argv.slice(2));
